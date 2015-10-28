angular.module('cv.ordering.productPanel', ['ngFitText'])

  .directive('orderingProductPanel', [function () {
      return {
          templateUrl: "views/ordering/components/productPanel/ordering.productPanel.html",
          restrict:    "AE",
          replace:     'true',
          scope:       {
              content:          '=',
              startingFromText: '@',
              priceText:        '&',
              currency:         '@',
              serviceTotal:     '=',
              chargeUnit:       '@'
          },
          controller:  function ($scope, $timeout, $rootScope) {

              $rootScope.$on('animation:finished', function () {
                  var price = $scope.content.price;
                  $scope.content.price = null;
                  $timeout(function () {
                      $scope.content.price = price;
                  });

              });

          }
      }
  }]);
