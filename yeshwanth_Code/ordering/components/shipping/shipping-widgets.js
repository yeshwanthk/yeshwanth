angular.module('cv.ordering.shippingWidgets', [])

  .directive('orderingAddressForm', [function () {
      return {
          templateUrl: "views/ordering/components/shipping/shipping-form.html",
          restrict:    "AE",
          replace:     "true",
          scope:       {
              address:    "&addressData",
              onComplete: "&"
          },
          controller:  function ($scope, serverOrdering) {
              $scope.returnAddress = {};
              //make local temp copy to allow cancel

              for (var field in $scope.address()) {
                  $scope.returnAddress[field] = $scope.address()[field]
              }

              $scope.saveForm = function () {

                  /* determine whether save is addAddress or updateAddress
                   based on whether addressId currently exists.
                   Server returns shippingAddressId for success either way.
                   */
                  if ($scope.returnAddress._id) {
                      //use updateAddress API
                      serverOrdering.updateAddress($scope.returnAddress).then(
                        function success(response) {
                            $scope.onComplete({data: $scope.returnAddress});
                        },
                        function error(response) {
                            $scope.addressError = response.error;
                        }
                      );
                  } else {
                      //use addAddress API and get new Id from server
                      serverOrdering.addAddress($scope.returnAddress).then(
                        function success(response) {
                            $scope.returnAddress._id = response._id;
                            $scope.onComplete({data: $scope.returnAddress});
                        },
                        function error(response) {
                            $scope.addressError = response.error;
                        }
                      );
                  }
              };

              $scope.cancelForm = function () {
                  $scope.returnAddress = {};
                  $scope.onComplete();
              };
          }
      }
  }
  ])

  .
  directive('shippingDevice', [function () {
      return {
          templateUrl: "views/ordering/components/shipping/shipping-device.html",
          restrict:    'AE',
          replace:     true,
          scope:       {
              showSiteInfo: "=",
              device:       "=",
              lastDevice:   "="
          }
      };
  }])

  .directive('shippingDeviceManager', [function () {
      return {
          templateUrl: "views/ordering/components/shipping/shipping-device-manager.html",
          restrict:    'AE',
          controller:  "ShippingDeviceManagerController",
          replace:     true,
          scope:       {
              allDevices:    "=",
              showSiteLabel: "=",
              provider:      "=",
              onComplete:    "="
          }
      };
  }])
  .controller('ShippingDeviceManagerController', ['$timeout', '$scope', function ($timeout, $scope) {

      //================================================
      //================================================
      $scope.provider.goToPrevious = function () {
          var prevIdx = $scope.currentDeviceIndex - 1;
          // If the last index is less than 0 then don't change the step
          if (prevIdx >= 0) {
              $scope.allDevices[$scope.currentDeviceIndex].status = 'default';
              $scope.provider.goToIndex(prevIdx);
          }
      };

      //================================================
      //================================================
      $scope.provider.goToNext = function () {
          var nextIdx = $scope.currentDeviceIndex + 1;
          var total = $scope.allDevices.length;
          // If the next index is beyond the max then don't change the step
          var isLast = (nextIdx >= total);
          if (!isLast) {
              $scope.allDevices[$scope.currentDeviceIndex].status = 'associated';
              $scope.provider.goToIndex(nextIdx);
          }
          return isLast;
      };

      //================================================
      //================================================
      $scope.provider.goToIndex = function (index) {
          $scope.currentDeviceIndex = index;
          $scope.allDevices[index].status = "selected";
          $scope.onComplete(index, $scope.allDevices[$scope.currentDeviceIndex].addressId);
      };

      //================================================
      //================================================
      $scope.provider.isLastDevice = function () {
          return ($scope.currentDeviceIndex === $scope.allDevices.length - 1);
      };

      //================================================
      //================================================
      $scope.provider.getCurrentDeviceIndex = function () {
          return $scope.currentDeviceIndex;
      };

      $scope.provider.getCurrentDeviceShippingId = function () {
          return $scope.allDevices[$scope.currentDeviceIndex].addressId;
      };

      //================================================
      //================================================
      $scope.provider.setShippingAddress = function (_id) {
          var device = $scope.allDevices[$scope.currentDeviceIndex];
          device.addressId = _id;
      };

      //================================================
      //================================================
      $scope.provider.cleanShippingAddress = function () {
          //clear out all addresses if allDevices has been populated

          if ($scope.allDevices) {
              for (var i = 0; i < $scope.allDevices.length; i++) {
                  var device = $scope.allDevices[i];
                  device.addressId = null;
                  device.status = 'default';

                  //want this to be null so it can take on the
                  //already selected installOptionType if nothing selected yet
                  device.installType = null;
                  $scope.allDevices[0].status = 'selected';
              }
              $scope.currentDeviceIndex = 0;
              //no parameters; just for resetting installation totals
              $scope.onComplete();
          }
      };

      //================================================
      //================================================
      $scope.provider.goToMissingAddress = function (key) {
          // Go through device list to find the first device
          // that does not have the shipping address associated
          var firstMissingIndex = -1;
          var isNoShippingAddress = ($scope.allDevices[0].addressId == null);
          var alreadyFoundMissingAddress = false;

          for (var i = 0; i < $scope.allDevices.length; i++) {
              // Before
              $scope.allDevices[i].status = 'associated';

              // Now
              if (!alreadyFoundMissingAddress && $scope.allDevices[i].addressId == key) {
                  $scope.allDevices[i].addressId = null;
                  firstMissingIndex = i;
                  alreadyFoundMissingAddress = true;
                  $scope.allDevices[firstMissingIndex].status = 'selected';
              }

              // After
              if ((i > firstMissingIndex && alreadyFoundMissingAddress) || isNoShippingAddress)
                  $scope.allDevices[i].status = 'default';
          }
          if (alreadyFoundMissingAddress)
              $scope.provider.goToIndex(firstMissingIndex);
      };
      $scope.currentDeviceIndex = 0;
  }])
;
