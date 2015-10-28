angular.module('cv.ordering.orderDevice', [
    'cv.ordering.shared',
    'cv.ordering.devicePurchasePanel',
    'cv.ordering.viewShipping',
    'cv.ordering.viewReviewOrder'])
  .controller('OrderDeviceController', ['serverOrdering', 'blockUI', 'currencyConversionFactory', '$scope', '$rootScope', '$state', 'installOptionsFactory', 'buildOrderFactory', 'adjustWindowHeightFactory', '$timeout', 'confirmationModal', 'confirmProgressLoss',
      function (serverOrdering, blockUI, currencyConversionFactory, $scope, $rootScope, $state, installOptionsFactory, buildOrderFactory, adjustWindowHeightFactory, $timeout, confirmationModal, confirmProgressLoss) {

          //provide object for devicePurchasePanel directive to populate
          $scope.optionsForOrder = {
              "devicesByAddress": {},
              "currency":         ""
          };

          //different to ordering.main; here we need quantities only
          $scope.userSelectedDeviceQuantities = {};
          //populate with null not 0 to avoid temporary display
          $scope.deviceCount = {data: null};
          $scope.allDevices = [];

          //allows the directive to tell orderDevice when the address form is showing (hide main back button)
          $scope.showAddressForm = {data: false};

          //provide initial state for ng-switch
          $scope.isReviewStep = false;
          var stepArray = ['devicePurchase', 'shipping', 'review'];
          var stepIndex = 0;
          $scope.step = stepArray[stepIndex];
          $scope.backButtonText = "SHARED.MODAL-CONFIRMATION.BUTTON-CANCEL";
          $rootScope.$broadcast('app:changePageTitle', 'ORDER.' + stepArray[stepIndex].toUpperCase() + '.TITLE');


          //set up warnings to prevent leaving ordering without confirmation if progressed
          var orderingBlock = blockUI.instances.get('orderDeviceBlock');
          confirmProgressLoss.registerLeaveWatches($scope, orderingBlock, getDeviceCatalog.bind(this));

          getDeviceCatalog();

          function getDeviceCatalog() {
              //place spinner while requesting deviceCatalog from server
              var deviceCatalogBlock = blockUI.instances.get('deviceCatalogBlock');
              deviceCatalogBlock.start();
              //populate deviceCatalog and currency
              serverOrdering.getDeviceCatalog()
                .then(function (response) {
                    deviceCatalogBlock.stop();
                    adjustWindowHeightFactory();

                    //for passing to reviewOrder and viewDeviceCatalog directive
                    $scope.currency = currencyConversionFactory.convert(response.currency);
                    $scope.deviceChargeType = response.chargeType;
                    $scope.deviceChargeUnit = response.chargeUnit;
                    $scope.installOptions = response.installOptions;
                    //console.log($scope.installOptions);

                    for (var i = 0; i < response.devices.length; i++) {
                        var catalogDevice = response.devices[i];

                        //me might be going back to this step, repopulate quantities from userSelectedDevices
                        var userSelectedDeviceQuantity = $scope.userSelectedDeviceQuantities[catalogDevice.deviceTypeId];
                        (userSelectedDeviceQuantity) ?
                        catalogDevice.userQuantity = userSelectedDeviceQuantity.userQuantity :
                        catalogDevice.userQuantity = 0;
                    }

                    $scope.deviceCatalog = response.devices;
                    //console.log("getDeviceCatalog deviceCatalog:", $scope.deviceCatalog);
                });
          }

          //holding to pass from shipping to review
          var addressList = {};

          //main logic on conclusion of each order step
          $scope.onStepCompleted = function (data) {

            if($rootScope.queue.disableEdit === false) {

              if (!data) {
                  //user has pressed back
                  stepIndex--;
              } else {

                  switch (data.key) {

                      case 'devicePurchase':

                          confirmProgressLoss.setProgressed(true);

                          $scope.allDevices = [];

                          $scope.installCount = 0;
                          $scope.installTotal = 0;
                          $scope.installPrice = 0;
                          //prepare allDevices object for shipping directive
                          for (var deviceIndex = 0; deviceIndex < $scope.deviceCatalog.length; deviceIndex++) {
                              var device = $scope.deviceCatalog[deviceIndex];
                              for (var i = 0; i < Number(device.userQuantity); i++) {
                                  device.status = 'default';
                                  device.addressId = null;

                                  $scope.allDevices.push(angular.copy(device));
                                  //assign so device totals are repopulated if the user goes back
                                  $scope.userSelectedDeviceQuantities[device.deviceTypeId] = {
                                      "userQuantity": device.userQuantity
                                  };
                              }
                          }
                          $scope.allDevices[0].status = 'selected';
                          stepIndex++;
                          break;

                      case 'shipping':

                          //prepare other scope variables for review directive
                          $scope.optionsForOrder.devicesByAddress = data.value;
                          addressList = data.addressList;

                          $scope.deviceTotal = 0;
                          for (var i = 0; i < $scope.allDevices.length; i++) {
                              var device = $scope.allDevices[i];
                              $scope.deviceTotal += Number(device.price);

                              var installPrice = installOptionsFactory.getInstallPrice($scope.installOptions, device.installType);
                              if (installPrice > 0) {
                                  $scope.installTotal += installPrice;
                                  $scope.installPrice = installPrice;
                                  $scope.installCount++;
                              }

                          }
                          //console.log($scope.allDevices);
                          $scope.isReviewStep = true;
                          stepIndex++;
                          break;

                      case 'review':

                          if (data.submitOrder == null) {
                              $scope.isReviewStep = false;
                              stepIndex--;

                          } else {

                              //build purchaseDevice
                              var order = {
                                  "devices": buildOrderFactory.buildDeviceList($scope.allDevices, addressList)
                              };

                              //console.log(order);
                              orderingBlock.start();
                              serverOrdering.purchaseDevice(order).then(
                                function success() {
                                    orderingBlock.stop();
                                    confirmProgressLoss.setConfirmedLeaving(true);
                                    $state.transitionTo('root.orderConfirmation');
                                }, function error(response) {
                                    orderingBlock.stop();

                                    //hide global generic error message pop-down for network errors
                                    $timeout(function () {
                                        $rootScope.$broadcast('global:hide');
                                    });
                                    var errorMsg = (response && response.message) ? response.message
                                      : "ORDER.REVIEW.UNKNOWN_ORDER_SUBMIT_ERROR";

                                    confirmationModal({
                                        bodyText:   errorMsg,
                                        hideCancel: true
                                    });
                                })
                          }
                          break;
                  }
              }

              $scope.step = stepArray[stepIndex];
              $rootScope.$broadcast('app:changePageTitle', 'ORDER.' + stepArray[stepIndex].toUpperCase() + '.TITLE');
              $scope.backButtonText = $scope.step === 'devicePurchase' ?
                                      "SHARED.MODAL-CONFIRMATION.BUTTON-CANCEL"
                : "SHARED.MODAL-CONFIRMATION.BUTTON-BACK";
            }
          };

          $scope.back = function () {
              if (stepIndex === 0) {
                  $state.transitionTo("root.dashboard");
              } else {
                  $scope.onStepCompleted();
              }
          };
      }
  ]);
