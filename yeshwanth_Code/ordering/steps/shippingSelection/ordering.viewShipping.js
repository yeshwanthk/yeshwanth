'use strict';

angular.module('cv.ordering.viewShipping', ['cv.ordering.shippingWidgets'])

  .directive('orderingViewShipping', [function () {
      return {
          templateUrl: "views/ordering/steps/shippingSelection/ordering.viewShipping.html",
          restrict:    'AE',
          replace:     true,
          controller:  "ViewShippingController",
          scope:       {
              allDevices:            "=",
              useRecommendedDevices: "=",
              onStepCompleted:       "&",
              showAddressForm:       "=",
              installOptions:        "=",
              updateTotals:          "=",
              currency:              '@'
          }
      };
  }])

  .controller('ViewShippingController', ['confirmationModal', 'serverOrdering', '$timeout', '$translate', '$scope', '$state', 'installOptionsFactory', 'CONST',
      function (confirmationModal, serverOrdering, $timeout, $translate, $scope, $state, installOptionsFactory, CONST) {

          //================================================
          // INITIALIZATION
          //================================================
          // Set up button states
          $scope.backButtonDisabled = true;
          $scope.nextButtonDisabled = true;
          $scope.nextButtonText = 'ORDER.REVIEW.BUTTON-REVIEW_ORDER';

          // Booleans for ng-switch view management
          $scope.shipToSingleAddress = true;
          $scope.showAddressForm = false;
          $scope.selectedInstallOption = {data: ""};
          //keeps track of addresses already chosen for professional install, to disallow
          //professional install of multiple devices at the same address
          var proInstallAddressAlreadySelected = {};

          // Device manager represents the shipping device manager directive
          $scope.deviceManager = {};
          $scope.isDeviceManagerAvailable = function () {
              return !$.isEmptyObject($scope.deviceManager);
          };
          $scope.getInstallType = installOptionsFactory.getInstallType;

          // update selectedInstallOption to default, when installOptions changes
          $scope.$watch('installOptions', function (newValue) {
              if (newValue) {
                  $scope.selectedInstallOption.data =
                    installOptionsFactory.getDefaultInstallType($scope.installOptions);

                  //disable ship to single address immediately if pro install is the only option
                  if (CONST.ORDERING_RESTRICT_PRO_INSTALL &&
                    $scope.selectedInstallOption.data === 'professional' &&
                    $scope.installOptions.length === 1
                  ) {
                      //this happens before we create allDevices, so don't run onToggle
                      $scope.shipToSingleAddress = false;
                      $scope.disableShipToSingleAddress = true;
                      $scope.nextButtonText = 'SHARED.MODAL-CONFIRMATION.BUTTON-NEXT';

                  }
                  else {
                      $scope.shipToSingleAddress = true;
                      $scope.disableShipToSingleAddress = false;
                      $scope.nextButtonText = 'ORDER.REVIEW.BUTTON-REVIEW_ORDER';
                  }
              }
          });

          //make sure address association resets if we navigate backwards
          $scope.$root.$on('animation:back', function () {
                $timeout(function () {
                    //wait until animation has finished so we don't see devices disappearing
                    $scope.onToggleShipToSingleAddress(true, true);
                }, 1000);
            }
          );

          //================================================
          // set option to selection
          //================================================
          $scope.selectInstallOption = function (installType) {

              //requirement is to not allow professional install at single address
              //this needs to happen first to reset the flags correctli
              if (CONST.ORDERING_RESTRICT_PRO_INSTALL &&
                installType === 'professional' && $scope.shipToSingleAddress) {
                  $scope.onToggleShipToSingleAddress(false);
              }

              $scope.selectedInstallOption.data = installType;

              //clear address out (since switching to professional installation may
              //mean that selected address is already taken by another device
              //this needs to happen before we run updateDeviceInstallType
              //so if it -was- installType === 'professional' it can be removed from the
              //proInstallAddressAlreadySelected pool
              deselectAddress($scope.currentAddressId);
              updateDeviceInstallType(installType);
          };

          //================================================
          // Callback when the checkbox for ship-to-all is clicked
          //================================================
          $scope.onToggleShipToSingleAddress = function (state, suppressAnimation) {
              //console.log('onToggleShipToSingleAddress:', $scope.shipToSingleAddress);

              $scope.shipToSingleAddress = (state === undefined) ? $scope.shipToSingleAddress : state;

              $scope.selectedInstallOption.data = installOptionsFactory.getDefaultInstallType($scope.installOptions);

              //requirement is to not allow professional install at single address
              if (CONST.ORDERING_RESTRICT_PRO_INSTALL &&
                $scope.selectedInstallOption.data === 'professional' && $scope.shipToSingleAddress) {
                  $scope.selectedInstallOption.data = 'self';
              }

              proInstallAddressAlreadySelected = {};

              // Remove all address association and change devices to currently selected
              if ($scope.isDeviceManagerAvailable()) {
                  $scope.deviceManager.cleanShippingAddress();
              }

              //expand scrollable container only if in view to avoid animation issues if going back
              if (!suppressAnimation) {
                  var scrollContainer = $('#ordering-main').find('#ordering-scrollable-container');
                  var shippingContainer = scrollContainer.find('.shipping-container');
                  (function (callback) {
                      scrollContainer.animate({scrollLeft: scrollContainer.scrollLeft() + shippingContainer.outerWidth()}, 500, callback);
                  })();
              }

              // Also reset the current shipping id so no device in the device manager will be highlighted
              $scope.currentAddressId = null;
              $scope.nextButtonDisabled = true;
              $scope.showAddressForm = false;

              if ($scope.updateTotals) {
                  $scope.updateTotals()
              }

              //now additionally runs onComplete/deviceManagerCallback below

          };

          //================================================
          // - controls the button logic based on index returned by deviceManager
          // - happens after goToNext, goToPrevious, and cleanShippingAddresses
          //================================================
          $scope.deviceManagerCallback = function (index, addressId) {

              if (index !== undefined && addressId !== undefined) {
                  $scope.currentAddressId = addressId;

                  //index is at the start - disable back button
                  $scope.backButtonDisabled = (index === 0);

                  // update the arrow position on the shipping address panel
                  $scope.selectedDeviceIdx = index;
                  //general updating after cleaning shippingAddresses
                  //change the nextButton to 'finish' if the user has already previously chosen address
                  $scope.nextButtonDisabled = ($scope.allDevices[index].addressId == null);
              }


              // update type selection
              var dIdx = $scope.deviceManager.getCurrentDeviceIndex();
              //only update installType from device if it's previously been chosen...
              if ($scope.allDevices && $scope.allDevices[dIdx] && $scope.allDevices[dIdx].installType) {
                  $scope.selectedInstallOption.data = $scope.allDevices[dIdx].installType;
              } else if ($scope.allDevices && $scope.allDevices[dIdx])
              //...take whatever's currently selected as that device's installType
              //so the totals update immediately - otherwise we'll never see the full
              //installTotal before clicking 'Review Order'
              {
                  $scope.allDevices[dIdx].installType = $scope.selectedInstallOption.data;
              }

              updateNextButtonText();

              if (!$scope.shipToSingleAddress) {
                  animateToSelectedDevice();
              }
          };

          //================================================
          // Go to the previous device
          //================================================
          $scope.goPrevious = function () {
              if ($scope.isDeviceManagerAvailable()) {
                  $scope.deviceManager.goToPrevious();
                  updateNextButtonText();
              }
          };

          //================================================
          // CLICK ON ADDRESS - associate to device and allow to move on
          //================================================

          //for the view only - dictate which addresses are blocked when in
          //professional install mode
          $scope.unavailableForProInstall = function (addressId) {
              if (CONST.ORDERING_RESTRICT_PRO_INSTALL) {
                  return $scope.selectedInstallOption.data === 'professional' &&
                    proInstallAddressAlreadySelected[addressId]
              }
              else {
                  return false;
              }
          };

          function deselectAddress(addressId) {
              //make pro install address available again
              //only if we're deselecting a device with pro install currently enabled
              //or wer're moving to other install options
              if ($scope.allDevices[$scope.deviceManager.getCurrentDeviceIndex()].installType === 'professional') {
                  proInstallAddressAlreadySelected[addressId] = false;
              }
              $scope.deviceManager.setShippingAddress(null);
              $scope.currentAddressId = null;
              $scope.nextButtonDisabled = true;
          }

          $scope.selectAddressForDevice = function (address) {

              var currentDeviceShippingId = $scope.deviceManager.getCurrentDeviceShippingId();

              //we have clicked on the same address box - so deselect it to free up
              if (currentDeviceShippingId === address._id) {
                  deselectAddress(address._id);
                  return;
              }

              //we're trying to select an already blocked device
              if ($scope.unavailableForProInstall(address._id)) {
                  return;
              }

              //otherwise select the new address
              if ($scope.shipToSingleAddress) {
                  for (var i = 0; i < $scope.allDevices.length; i++) {
                      var device = $scope.allDevices[i];
                      device.addressId = address._id;
                      device.installType = $scope.selectedInstallOption.data;
                  }
              }
              else {
                  //address for single device has changed
                  //also (currentDeviceShippingId !== address._id) as screened above
                  if (currentDeviceShippingId && proInstallAddressAlreadySelected[currentDeviceShippingId]) {
                      // make the unselected professional one available again, if it's not the first (null) one
                      proInstallAddressAlreadySelected[currentDeviceShippingId] = false;
                  }
                  //set the current device to the selected addressId
                  $scope.deviceManager.setShippingAddress(address._id);
                  if ($scope.selectedInstallOption.data === 'professional') {
                      proInstallAddressAlreadySelected[address._id] = true;
                  }
              }
              //single or multiple, set that address as selected visually
              $scope.currentAddressId = address._id;
              $scope.nextButtonDisabled = false;
              //this also updates the totals
              updateDeviceInstallType($scope.selectedInstallOption.data);

              //check if we're at the final step
              updateNextButtonText();
          };

          //================================================
          // Go to the next device
          //================================================
          $scope.goNext = function (data) {
              if (!$scope.isDeviceManagerAvailable() && !$scope.shipToSingleAddress) {
                  return;
              }

              var isLastDevice = $scope.isDeviceManagerAvailable();
              if (isLastDevice && !$scope.shipToSingleAddress) {
                  isLastDevice = $scope.deviceManager.goToNext();
              } else {
                  isLastDevice = true;
              }

              // Are we done?
              if (isLastDevice) {
                  // Yes, this is the last step so start building the device <--> shipping object
                  var devicesByAddress = buildShippingObject();
                  // This last step is completed, now trigger the callback to notify the controller
                  $scope.onStepCompleted({
                      data: {
                          'key':         'shipping',
                          'value':       devicesByAddress,
                          'addressList': $scope.addressList,
                          'allDevices':  $scope.allDevices,
                          'event':       data.$event,
                          widgetInfo:    data.widgetInfo
                      }
                  });
              }
          };

          //============================================================
          // deviceManagerCallback and general updating helper functions
          //============================================================
          function updateDeviceInstallType(installType) {
              if ($scope.shipToSingleAddress) {
                  // save install type to all devices if ship to one address
                  _.map($scope.allDevices, function (device) {
                      device.installType = installType;
                  });
              } else {
                  // if not single address, then save install type
                  var dIdx = $scope.deviceManager.getCurrentDeviceIndex();
                  $scope.allDevices[dIdx].installType = installType;
              }
              if ($scope.updateTotals) {
                  $scope.updateTotals()
              }
          }

          var updateNextButtonText = function () {
              if ($scope.shipToSingleAddress || ($scope.isDeviceManagerAvailable() && $scope.deviceManager.isLastDevice())) {
                  $scope.nextButtonText = 'ORDER.REVIEW.BUTTON-REVIEW_ORDER';
              } else {
                  $scope.nextButtonText = 'SHARED.MODAL-CONFIRMATION.BUTTON-NEXT';
              }
          };

          //================================================
          // Group all devices by address before going to the next step
          // (this object only for ReviewOrder screen display, nothing else)
          //================================================
          var buildShippingObject = function () {
              var shippingAddresses = {};

              for (var deviceIndex = 0; deviceIndex < $scope.allDevices.length; deviceIndex++) {
                  var d = $scope.allDevices[deviceIndex];
                  addShippingDevice(d, d.installType);
              }

              function addShippingDevice(device, installType) {
                  if (!shippingAddresses[installType]) {
                      shippingAddresses[installType] = {};
                  }
                  var shippingInstallGroup = shippingAddresses[installType];
                  if (!shippingInstallGroup[device.addressId]) {
                      //new shipping address to group by, copy the whole address over
                      shippingInstallGroup[device.addressId] = angular.copy($scope.addressList[device.addressId]);
                      shippingInstallGroup[device.addressId].devicesToAddress = {};
                  }

                  //copy first time only to preserve userQuantity once we begin incrementing
                  var devicesToShippingAddress = shippingInstallGroup[device.addressId].devicesToAddress;
                  if (!(devicesToShippingAddress[device.deviceTypeId])) {
                      devicesToShippingAddress[device.deviceTypeId] = angular.copy(device);
                      devicesToShippingAddress[device.deviceTypeId].quantityToAddress = 1;
                  }
                  else {
                      devicesToShippingAddress[device.deviceTypeId].quantityToAddress++;
                  }
              }

              return shippingAddresses;
          };

          //===========================================
          // ANIMATION: to go to current shipping device
          //===========================================
          var animateToSelectedDevice = function () {

              //check heights once the device manager has applied new selected classes

              $timeout(function () {
                  var fixedParent = $('#shipping-fixed-container');
                  var scrollContainer = $('#shipping-device-scroll-container');
                  var scrollElement = scrollContainer.find('#shipping-device.selected');

                  if (scrollElement && scrollElement.offset()) {
                      var parentTop = fixedParent.offset().top;
                      var elementTop = scrollElement.offset().top;
                      var parentBottom = parentTop + fixedParent.outerHeight();
                      var elementBottom = elementTop + scrollElement.outerHeight();

                      if (elementBottom > parentBottom) {
                          scrollContainer.animate({scrollTop: scrollContainer.scrollTop() + (elementBottom - elementTop)}, 500);
                      }
                      if (elementTop < parentTop) {
                          scrollContainer.animate({scrollTop: scrollContainer.scrollTop() - (elementBottom - elementTop)}, 500);
                      }
                  }
              }, 100);
          };


          //================================================
          // ADDRESS Functions:
          // getAddressList API
          //================================================

          $scope.addressList = {};
          $scope.currentAddressId = -1;
          $scope.currentAddress = {};

          serverOrdering.getAddressList()
            .then(function success(response) {
                if (response.status && Number(response.status) === 0) {

                    //only show error if we haven't been redirected to login by now
                    if ($state.current.name !== 'root.login') {
                        $scope.$root.$emit('global:error', {key: "ERRORS.NETWORK_ERROR"});
                    }
                    $scope.addressListEmpty = true;
                }
                else {
                    var addressList = response.results;
                    if (addressList.length !== 0) {
                        for (var i = 0; i < addressList.length; i++) {
                            $scope.addressList[addressList[i]._id] = addressList[i];
                        }
                        $scope.addressListEmpty = false;
                    } else {
                        $scope.addressListEmpty = true;
                    }

                }
            }, function error(response) {
                $scope.addressListEmpty = true;

                console.error(response);
            }
          );

          //================================================
          // Callback when the address form is completed
          //================================================

          $scope.addressFormCallback = function (data) {

              //orderingAddressForm returns no data parameter if cancelled
              if (data !== undefined) {
                  //address form has been saved; update addressList
                  $scope.addressList[data._id] = data;
                  $scope.selectAddressForDevice(data)
              }
              $scope.addressError = null;
              $scope.showAddressForm = false;
          };

          //================================================
          // Open the address form for adding a new address
          //================================================
          $scope.addNewAddress = function () {
              $scope.currentAddress = {};
              $scope.showAddressForm = true;
          };

          //================================================
          // Open the address form for editing a new address
          //================================================
          $scope.editAddress = function (address) {
              $scope.currentAddress = address;
              $scope.showAddressForm = true;
          };

          //================================================
          // Pop up the q and ask for deleting
          //================================================
          $scope.deleteAddress = function (addressId) {
              $scope.addressError = null;

              //var action = serverOrdering.deleteAddress.bind(this, addressId);

              confirmationModal({
                  headerText: 'ORDER.SHIPPING.MODAL-ADDRESS_DELETION.HEADER',
                  bodyText:   'ORDER.SHIPPING.MODAL-ADDRESS_DELETION.MESSAGE',
                  action:     serverOrdering.deleteAddress.bind(this, addressId)
              })
                .then(function success() {
                    delete $scope.addressList[addressId];
                    // Since the shipping address was removed, we need to find other
                    // devices that used this shipping address earlier
                    if ($scope.isDeviceManagerAvailable()) {
                        $scope.deviceManager.goToMissingAddress(addressId);
                    }

                    // When the last shipping address is deleted,
                    // we want to show the address form automatically
                    if (Object.keys($scope.addressList).length === 0) {
                        $scope.showAddressForm = true;
                    }
                }, function error(result) {
                    if (!result || result !== 'cancelled') {
                        confirmationModal({
                            hideCancel: true,
                            bodyText:   'ERRORS.NETWORK_ERROR'
                        })
                    }
                });
          };
      }
  ])
;

