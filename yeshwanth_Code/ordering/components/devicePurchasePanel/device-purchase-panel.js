angular.module('cv.ordering.devicePurchasePanel', [])

  .controller('DevicePurchasePanelController', ['$scope', function ($scope) {

      //update totals on ng-change of input fields
      $scope.updateSubTotal = function () {
          $scope.deviceCount = 0;
          $scope.deviceSubtotal = 0;
          for (var i = 0; i < $scope.deviceCatalog.length; i++) {
              var device = $scope.deviceCatalog[i];

              //add in '0' if input has been cleared
              device.userQuantity = (!device.userQuantity || device.userQuantity === "")
                ? 0 : Number(device.userQuantity);
              $scope.deviceCount += device.userQuantity;
              //backend may send -1 values in some cases
              if (Number(device.price) > 0) {
                  $scope.deviceSubtotal += Number(device.userQuantity) * Number(device.price);
              }
          }
      };

      //run it on each server fetch to populate totals, once deviceCatalog is ready
      //no oldValue !== newValue check because deviceCatalog here is actually deviceCatalog.devices
      //so the object is not changing for purposes of $watch and no need to deep watch for this
      $scope.$watch('deviceCatalog', function (newValue) {
          if (newValue) {
              for (var i = 0; i < $scope.deviceCatalog.length; i++) {
                  var device = $scope.deviceCatalog[i];
                  //server sends string prices and we need to orderBy price
                  device.price = Number(device.price);
              }
              $scope.updateSubTotal();
          }
      });

  }])

  .directive('devicePurchasePanel', [function () {
      return {
          templateUrl: "views/ordering/components/devicePurchasePanel/device-purchase-panel.html",
          controller:  "DevicePurchasePanelController",
          restrict:    "AE",
          replace:     true,
          scope:       {
              deviceCatalog: '=',
              deviceCount:   '=',
              currency:      '@',
              chargeUnit:    '@',
              chargeType:    '@'
          }
      };
  }]);