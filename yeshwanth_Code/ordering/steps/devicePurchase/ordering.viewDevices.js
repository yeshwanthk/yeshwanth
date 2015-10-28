angular.module('cv.ordering.viewDevices', ['cv.ordering.devicePurchasePanel',])

  .controller('ViewDevicesController', ['serverOrdering', '$modal', '$scope', 'blockUI', '$timeout',
      function (serverOrdering, $modal, $scope, blockUI, $timeout) {

          $scope.userSelectedDevices = {};
          // need to init deviceCount before first load in case the user has no recommendations
          $scope.deviceCount = 0;
          $scope.deviceCost = 0;
          $scope.selectionChanged = false;

          $scope.shouldDisplaySubtotal = function (displayDevice) {
              if (displayDevice.userQuantity > 1 && Object.keys($scope.userSelectedDevices).length > 1) {
                  return _.every($scope.userSelectedDevices, function (device) {
                      return device.userQuantity !== 0;
                  })
              }
              return false;
          };

          //build when recommendations are first populated to save recommended quantities
          var userRecommendedDevices = {};

          $scope.$watch('recommendedDevices', function (newValue, oldValue) {
              if ($scope.recommendedDevices != null && newValue !== oldValue) {
                  // Reset the deviceSummary because the user may go back and revisit the device view
                  $scope.userSelectedDevices = {};
                  $scope.userRecommendedDevices = {};
                  $scope.useRecommendedDevices = true;
                  $scope.deviceCount = 0;
                  $scope.deviceCost = 0;


                  //get chargeType/Unit separate from getOffers, since devices may be hired
                  $scope.deviceChargeType = $scope.recommendedDevices.chargeType;
                  $scope.deviceChargeUnit = $scope.recommendedDevices.chargeUnit;

                  //go through sites
                  for (var siteIndex in $scope.recommendedDevices.sites) {
                      var site = $scope.recommendedDevices.sites[siteIndex];

                      for (var deviceIndex in site.devices) {
                          var device = site.devices[deviceIndex];
                          var userSelectedDevice = {};
                          // The current backend restriction is one device per site
                          // (will remove this when they can support multiple device per site)
                          device.recommendedQuantity = 1;

                          if (!$scope.userSelectedDevices[device.deviceTypeId]) {
                              $scope.userSelectedDevices[device.deviceTypeId] = device;
                              $scope.userSelectedDevices[device.deviceTypeId].userQuantity = Number(device.recommendedQuantity);
                          } else {
                              $scope.userSelectedDevices[device.deviceTypeId].userQuantity += Number(device.recommendedQuantity);
                          }

                          if (!userRecommendedDevices[device.deviceTypeId]) {
                              //recommended devices is always the base for comparison this way, even if devices are
                              // added/deleted
                              userRecommendedDevices[device.deviceTypeId] = {recommendedQuantity: device.recommendedQuantity};
                          }
                          else {

                              userRecommendedDevices[device.deviceTypeId].recommendedQuantity++;
                          }

                          $scope.deviceCount += Number(device.recommendedQuantity);
                          $scope.deviceCost += Number(device.recommendedQuantity) * Number(device.price);
                      }
                  }
                  $scope.devicesSelected = true;

                  //later display is based on deviceCount/cost being present so we must update totals
                  //without saying that recommended devices have been changed
                  $scope.updateDeviceTotals(false, $scope.userSelectedDevices)
              }
          });

          $scope.$root.$on('animation:back', function () {
              $scope.selectionChanged = false;
          });


          $scope.updateDeviceTotals = function (selectionChanged, newUserSelectedDevices) {

              $scope.devicesSelected = false;

              //selection has changed; if the user has navigated back from shipping to 'check',
              //we can't reliably maintain their installTotal anymore
              if (selectionChanged) {
                  $scope.selectionChanged = selectionChanged;
                  //switching the propertied object with a new one,
                  //versus changing a single property only on the same object, triggers the two-way binding
                  $scope.installTotal = {data: 0}
              }
              $scope.useRecommendedDevices = true;

              $scope.deviceCount = 0;
              $scope.deviceCost = 0;


              //check for devices in userRecommendedDevices that are no longer in userSelectedDevices
              _.each(userRecommendedDevices, function (device, id) {
                  if (!newUserSelectedDevices.hasOwnProperty(id)) {
                      $scope.useRecommendedDevices = false;
                  } else if (Number(device.recommendedQuantity) !== Number(newUserSelectedDevices[id].userQuantity)) {
                      $scope.useRecommendedDevices = false;
                  }
              });


              // check for devices in userSelectedDevices that aren't in recommendedDevices,
              // or for devices that are still in both,
              // but which no longer have quantities matching the recommended ones
              _.each(newUserSelectedDevices, function (device) {

                    device.userQuantity = (!device.userQuantity || device.userQuantity === "")
                      ? 0 : Number(device.userQuantity);

                    if (!userRecommendedDevices.hasOwnProperty(device.deviceTypeId) && device.userQuantity !== 0) {
                            $scope.useRecommendedDevices = false;
                        } else if (Number(device.userQuantity) !== Number(userRecommendedDevices[device.deviceTypeId].recommendedQuantity)) {
                        $scope.useRecommendedDevices = false;
                        }


                    $scope.devicesSelected = $scope.devicesSelected || (Number(device.userQuantity) !== 0);

                    $scope.deviceCount += device.userQuantity;
                    //server may return -1 for some products
                    if (Number(device.price) > 0) {
                        $scope.deviceCost += device.userQuantity * Number(device.price);
                    }
                }
              );
          };

          $scope.openViewDeviceCatalogModal = function () {

              //fetch and prepare deviceCatalog before opening modal
              var deviceCatalogBlock = blockUI.instances.get('deviceCatalogBlock');
              deviceCatalogBlock.start();

              serverOrdering.getDeviceCatalog()
                .then(function (response) {

                    //populate devices with any pre-filled input from userSelectedDevices
                    for (var i = 0; i < response.devices.length; i++) {
                        var catalogDevice = response.devices[i];
                        var userSelectedDevice = $scope.userSelectedDevices[catalogDevice.deviceTypeId];

                        if (userSelectedDevice) {
                            catalogDevice.userQuantity = userSelectedDevice.userQuantity;
                            if (!catalogDevice.userQuantity || catalogDevice.userQuantity === "") {
                                catalogDevice.userQuantity = 0;
                            }
                        } else {
                            catalogDevice.userQuantity = 0;
                        }
                        catalogDevice.price = Number(catalogDevice.price);
                    }


                    var selectDeviceModal = $modal.open({
                        controller:  'ViewDeviceCatalogModalController',
                        templateUrl: 'views/ordering/steps/devicePurchase/ordering.modal.viewDeviceCatalog.html',
                        windowClass: 'device-catalog-modal',
                        resolve:     {
                            /* TODO: pass these three variables via scope, not resolve
                             (no $scope syntax example for Angular/Foundation modal online)
                             */
                            currency:           function () {
                                return $scope.currency;
                            },
                            deviceCatalog:      function () {
                                return response;
                            },
                            //these two pass through the data/flags for the recommended devices box
                            recommendedDevices: function () {
                                return $scope.recommendedDevices;
                            }
                        }
                    });

                    deviceCatalogBlock.stop();

                    // use returned modal result to replace existing list
                    selectDeviceModal.result.then(function (returnOptions) {
                        $scope.updateDeviceTotals(true, returnOptions.newDeviceSummary);

                        $scope.userSelectedDevices = returnOptions.newDeviceSummary;

                        //this will bind back to ordering.main to provide the header and
                        //review page with info
                        $scope.deviceChargeUnit = returnOptions.deviceChargeUnit;
                        $scope.deviceChargeType = returnOptions.deviceChargeType;
                    })
                });

          };

          $scope.saveAndComplete = function (data) {

              //this is to remove any devices with 0 userQuantity before proceeding,
              //so we display site info or not correctly on the shipping page
              //(but keep the ability to display devices that have been set to '0' with
              //immediately hiding them
              $scope.updateDeviceTotals(false, $scope.userSelectedDevices);
              $scope.onStepCompleted(data);
          }

      }])
  .
  controller('ViewDeviceCatalogModalController', ['$scope', '$modalInstance', 'currency', 'deviceCatalog', 'recommendedDevices',
      function ($scope, $modalInstance, currency, deviceCatalog, recommendedDevices) {

          //pass to the purchase panel directive for initial value population
          $scope.currency = currency;
          $scope.recommendedDevices = recommendedDevices;
          $scope.deviceChargeType = deviceCatalog.chargeType;
          $scope.deviceChargeUnit = deviceCatalog.chargeUnit;
          $scope.deviceCatalog = deviceCatalog.devices;
          $scope.deviceCount = {"data": null};


          //function executed on modal save; builds new deviceSummary to pass back
          $scope.updateUserSelectedDevices = function () {
              var newDeviceSummary = {};
              for (var deviceIndex in $scope.deviceCatalog) {
                  var device = $scope.deviceCatalog[deviceIndex];

                  if (device.userQuantity !== 0 && device.userQuantity !== undefined) {
                      newDeviceSummary[device.deviceTypeId] = angular.copy(device);
                  }
              }
              //pass back the updated device list with new userQuantity, only if saved
              //we need to save the deviceChargeType to bubble it back to ordering.main
              //in case the user opted to skip recommended devices and so never received it
              $modalInstance.close({
                  newDeviceSummary: newDeviceSummary,
                  deviceChargeType: $scope.deviceChargeType,
                  deviceChargeUnit: $scope.deviceChargeUnit
              });
          };

          // cancel modal - preserves original userSelectedDevices quantities
          $scope.cancel = function () {
              $modalInstance.dismiss('selection cancelled');
          };
      }])

  .
  directive('orderingViewDevices', function () {
      return {
          templateUrl: "views/ordering/steps/devicePurchase/ordering.viewDevices.html",
          restrict:    'AE',
          replace:     true,
          controller:  "ViewDevicesController",
          scope:       {

              onStepCompleted:         "&",
              recommendedDevices:      "=",
              currency:                "@",
              hasExistingSubscription: '=',
              installTotal:            '=',
              //these are for bubbling information back up to ordering
              deviceChargeUnit:        "=",
              deviceChargeType:        "="
          }
      };

  })

  .directive('orderingViewRecommendedDevices', function () {
      return {
          templateUrl: "views/ordering/steps/devicePurchase/ordering.viewRecommendedDevices.html",
          restrict:    'AE',
          replace:     true,
          scope:       {
              recommendedDevices: "="
          }
      };
  });
