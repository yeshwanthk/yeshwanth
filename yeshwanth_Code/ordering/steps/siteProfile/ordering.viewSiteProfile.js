angular.module('cv.ordering.viewSiteProfile', [])
  .controller('ViewSiteProfileController', ['$scope', '$translate',
      function ($scope, $translate) {

          $scope.numberSites = 0;
          $scope.savedSiteArray = [];
          $scope.Math = window.Math;

          $scope.tempArray = function (num) {
              var a = [];
              for (var i = 0; i < num; i++) {
                  a[i] = i;
              }
              return a;
          };

          /*Returns a new empty array from the number of sites specified that
           * ng-repeat can iterate through on change and populate via ng-model to
           * recommendations.siteArray[$index] */

          $scope.maxSites = 99;
          $scope.tempSiteArray = function (numberSites) {
              if (!numberSites) {
                  return 0;
              } else if (Number(numberSites) >= $scope.maxSites) {
                  return new Array(Number($scope.maxSites))
              }
              else {
                  return new Array(Number(numberSites))
              }
          };

          $scope.maxEmployeeGrowth = 2;
          $scope.employeeGrowth = 1;

          //stores showRecommendations boolean and passes customer info to backend
          $scope.selectRecommendations = function (data) {
              var siteProfile = {};
              siteProfile.showRecommendations = data.showRecommendations;

              var readyToProgress = false;
              if (data.showRecommendations === true) {
                  if ($scope.numberSites === 0 || $scope.numberSites === undefined) {
                      //TODO - modal
                      var warning = $translate.instant("ORDER.SITEPROFILE.ALERT_NO_INPUT");
                      alert(warning);
                  }
                  else {
                      readyToProgress = true;
                      /* prune undefined array values, but keeping site record
                       * if user has explicitly entered '0' users for a site */
                      var totalUsers = 0;
                      var trimmedSites = [];
                      for (var i = 0; i < $scope.numberSites; i++){
                          trimmedSites.push($scope.savedSiteArray[i] || 0);
                          totalUsers += $scope.savedSiteArray[i];
                      }

                      //build recommendations object
                      if (trimmedSites !== 0) {
                          siteProfile.sites = trimmedSites;
                      }
                      //return number 1-3
                      siteProfile.employeeGrowth = Math.ceil(Number(3 * ($scope.employeeGrowth + 1) / ($scope.maxEmployeeGrowth + 1)));
                  }
              } else {
                  readyToProgress = true;
              }

              if (readyToProgress) {
                  $scope.onStepCompleted({
                      data: {
                          "key":        'siteProfile',
                          "value":      siteProfile,
                          "event":      data.event,
                          "widgetInfo": data.widgetInfo
                      }
                  });
              }
          };
      }])

  .directive('orderingViewSiteProfile', function () {
      return {
          templateUrl: "views/ordering/steps/siteProfile/ordering.viewSiteProfile.html",
          restrict:    'AE',
          replace:     true,
          controller:  "ViewSiteProfileController",
          scope:       {

              onStepCompleted: "&",
              isAnimating: "="

          }
      };
  })

  .directive('selectOnClick', function () {
      return {
          restrict: 'A',
          link:     function (scope, element, attrs) {
              element.on('click', function () {
                  this.select();
              });
          }
      };
  });
