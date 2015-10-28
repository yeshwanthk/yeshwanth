'use strict';

angular.module('cv.ordering.viewReviewOrder', [])

  .directive('orderingViewReviewOrder', function () {
      return {
          templateUrl: "views/ordering/steps/review/ordering.viewReviewOrder.html",
          restrict:    'AE',
          replace:     true,
          scope:       {

              //input
              optionsForOrder:   "=",
              //pass data back from selection button to main controller event
              serviceTotal:      "=",
              deviceTotal:       "=",
              installCount:      '@',
              installPrice:      '@',
              installTotal:      '=',
              onStepCompleted:   "&",
              currency:          "@",
              serviceChargeType: "@",
              serviceChargeUnit: "@",
              deviceChargeUnit:  '=',
              deviceChargeType:  '=',
              shippingOptions:   '='
          },
          controller: function () {

          }
      };
  });
