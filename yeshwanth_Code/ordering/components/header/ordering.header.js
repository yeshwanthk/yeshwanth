angular.module('cv.ordering.header', [])

  .directive('orderingHeader', [
      function () {
          return {
              templateUrl: "views/ordering/components/header/ordering.header.html",
              restrict:    "AE",
              replace:     'true',
              scope:       {
                  title:             "=",
                  showBasket:        '=',
                  serviceTotal:      '=',
                  deviceTotal:       '=',
                  installTotal:      '=',
                  currency:          '@',
                  serviceChargeUnit: '@',
                  deviceChargeUnit:  '=',
                  deviceChargeType:  '='
              }
          }
      }])
  .filter('removeDecimal', function () {
      return function (str) {
          var decimal = str.substr(str.length, -2);
          return (decimal == 0) ? str.replace(".00", "") : str;
      };
  });
