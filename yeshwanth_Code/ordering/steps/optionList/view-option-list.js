'use strict';
angular.module('cv.ordering.viewOptionList', [])

  .directive('orderingViewOptionList', function () {
      return {
          templateUrl: "views/ordering/steps/optionList/view-option-list.html",
          restrict:    'AE',
          replace:     true,
          controller:  ['$scope', '$translate', '$timeout', function ($scope, $translate, $timeout) {

              var valueUnit = null;
              $scope.$watch('parentOption', function (newValue) {

                  if (newValue !== undefined) {

                      if (newValue.type === 'incremental') {

                          // copy so we can manipulate the properties independently
                          // just for incremental options, because we need to pass object down again
                          // and dynamically manipulate the productPanel directive
                          $scope.option = angular.copy($scope.parentOption);

                          $scope.showGrid = ($scope.option.maxValue - $scope.option.minValue) / $scope.option.increment <= 28;

                          $scope.recText = $translate.instant("ORDER.USERS.RECOMMENDED");
                          $scope.option.name = $scope.option.minValue + ' ' + $scope.option.valueUnit;
                          $scope.option.selectedValue = $scope.option.recValue || $scope.option.minValue;

                          //TODO - replace this with commented code once we have full paragraph translated context for users
                          $scope.option.incrementText = $scope.option.valueUnit;
                          /*$scope.option.incrementText = ($scope.option.valueUnit === 'users') ?
                                                        (($scope.option.increment === 1) ? $translate.instant("SHARED.USER.SINGLE") : $translate.instant("SHARED.USER.PLURAL")) :
                                                        $scope.option.valueUnit;*/
                          valueUnit = $scope.option.valueUnit;

                          //set up scale for recommended slider
                          $scope.hideSliderUnits = (($scope.option.maxValue - $scope.option.minValue) / $scope.option.increment) > 50;
                          $scope.sliderScale = [];
                          for (var i = $scope.option.minValue; i <= $scope.option.maxValue; i += $scope.option.increment) {
                              $scope.sliderScale.push(i === $scope.option.recValue);
                          }

                          //reset the selectedValue watch points below
                          //(it will not trigger if the user didn't change the selectedValue
                          //before re-calling getRecommendations API
                          updateIncrementalProductPanel();
                          //console.log(JSON.stringify($scope.option, null, 2));
                      } else {
                          //the default (non-incremental) case
                          $scope.option = $scope.parentOption;
                          //ng-repeat through option.choices directly sometimes
                          //does not enter nested choices property!
                          $scope.choices = $scope.option.choices;
                      }
                  }
              });

              $scope.usersPrettifyFunc = function (num) {
                  return num.toString() + ' ' + $scope.option.valueUnit;
              };


              $scope.$watch('option.selectedValue', function (newValue) {
                  if (newValue !== undefined) {
                      updateIncrementalProductPanel();
                  }
              });
              $scope.increment = function (increment, goToRec) {

                  if (goToRec) {
                      $scope.option.selectedValue = $scope.option.recValue
                  } else if ($scope.option.selectedValue + increment >= $scope.option.minValue
                    && $scope.option.selectedValue + increment <= $scope.option.maxValue) {
                      $scope.option.selectedValue += increment;
                  }
              };
              //for updating the price and name in product panel only during dragging
              function updateIncrementalProductPanel() {
                  $scope.option.price = ($scope.option.selectedValue - $scope.option.minValue) * $scope.option.incrementPrice;

                  //just for users hvalueUnit, to dynamically return the correct pluralization we have
                  if (valueUnit === 'users') {
                      $scope.option.valueUnit = ($scope.option.selectedValue === 1) ? $translate.instant("SHARED.USER.SINGLE") : $translate.instant("SHARED.USER.PLURAL")
                  }
                  $scope.option.name = $scope.option.selectedValue + ' ' + $scope.option.valueUnit;
              }

          }],
          scope:       {
              parentOption:    '=option',
              onStepCompleted: "&",
              currency:        '@',
              chargeUnit:      '@',
              serviceTotal:    '='
          }
      };
  });
