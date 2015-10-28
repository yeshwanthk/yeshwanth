'use strict';

angular.module('cv.services')

  .controller('ServicesDetailsController', ['$rootScope', '$scope', '$modal', '$q', '$translate', '$timeout', '$window', 'serverServices', 'CONST', 'blockUI', 'graphConfig',
      function ($rootScope, $scope, $modal, $q, $translate, $timeout, $window, $serverServices, CONST, blockUI, graphConfig) {

      $scope.CONST = CONST;


      var loadServiceMonthlyUsage = function () {
          $serverServices.getMonthlyServiceUsage($scope.service.id).then(function (response) {
              $scope.service.monthlyUsage = response;

              // Remove spinner
              var monthlyUseBlock = blockUI.instances.get('serviceMonthlyUseBreakdown');
              monthlyUseBlock.stop();

              if ($scope.service.monthlyUsage.usageGb && $scope.service.monthlyUsage.quotaGb) {

                  var usageGb = parseInt(response.usageGb);
                  var quotaGb = parseInt(response.quotaGb);
                  var availableGb = response.quotaGb - usageGb;

                  $scope.monthlyUsage = [
                      !isNaN(usageGb) ? usageGb : 0,
                      !isNaN(availableGb) ? availableGb : 0
                  ];
                  $timeout(function () {
                      $scope.addMonthlyUsageLegend(usageGb, usageGb + availableGb, quotaGb);
                  }, 150)

              } else {
                  $scope.monthlyUsage = [];
              }
          });
      };

      $scope.showDetails = false;
      $scope.currentServiceOptionsIdx = null;

      $scope.enterServiceOptionsDetails = function (service) {

          $('.service-panel-slider').css('width', '930px');
          $('.service-panel-slider-cell.set-width').css('width', '50%');
          $('#services-details-panel').css('display', 'inline-block');

          $scope.service._blockMap = true;
          $scope.showDetails = true;
          $rootScope.$emit('map:block', 'details_open');

          $scope.currentServiceOptionsIdx = service._idx;

          setTimeout(function () {
              var $scrollElem = $('.service-panel');
              $scrollElem.animate({scrollTop: 0}, 800);
          }, 500);
      };

      $scope.backToSitePanel = function () {

          setTimeout(function() {
              $('.service-panel-slider').css('width', '469px');
              $('.service-panel-slider-cell.set-width').css('width', '100%');
              $('#services-details-panel').css('display', 'none');

              var $scrollElem = $('.service-panel');
              $scrollElem.animate({scrollTop: 0}, 800);

          }, 500);

          $scope.showDetails = false;
          $scope.service._blockMap = false;
          $rootScope.$emit('map:unblock', 'details_open');
      };

      $rootScope.$on('updateBars', function () {
          $scope.updateBars();
      });

      $scope.updateBars = function () {

          function findMaxLimit(buckets) {
              var maxLimit = 0;
              for (var e in buckets) {
                  var limit = buckets[e].length;
                  if (buckets[e].hasOwnProperty('limit') &&
                    buckets[e].limit > limit) {
                      limit = buckets[e].limit;
                  }
                  maxLimit = limit > maxLimit ? limit : maxLimit;
              }
              return maxLimit;
          }

          var bucketOptions = _.filter($scope.serviceOptions, {'type': 'bucket'});

          bucketOptions.forEach(function (option) {
              var buckets = option.buckets;
              var maxLimit = parseInt(findMaxLimit(buckets));
              var elm = $(".service-options #bucket-" + option._idx);
              elm.find('tr.buckets-bars').css('height', (maxLimit * 10) + 'px');

              for (var e in buckets) {
                  var id = "bar-" + e;
                  var bucket = buckets[e];

                  var len = bucket.contains.length;
                  var tot = bucket.limit ? bucket.limit : len;

                  var $outer = elm.find('#' + id);
                  $outer.css('height', (tot * 10) + 'px');

                  var $inner = elm.find('#' + id + ' .inner-bar');
                  $inner.css('height', ((tot - len) * 10) + 'px');
              }
          });
      };

      $scope.$watch('service', function (data) {

          if (data) {
              loadServiceMonthlyUsage();

              $serverServices.getServiceOptions($scope.service.id)
                .then(function (response) {

                    // Set security options
                    $scope.serviceOptions = response;

                    // add unique index to each option
                    var idx = 0;
                    _.map($scope.serviceOptions, function (option, key) {
                        if (typeof option == "object") {
                            option._id = key;
                            option._idx = idx;
                            idx++;
                        }
                    });

                    //console.log('serviceOptions:', $scope.serviceOptions);

                    // Update buckets bars
                    setTimeout(function () {
                        $scope.updateBars();
                    }, 100);
                });

              // close any open marker popovers
              $rootScope.$broadcast('map:marker:closePopup');
          }
      });

      $scope.openServiceUsageHistory = function (e) {
          e.preventDefault();

          var modalInstance = $modal.open({
              templateUrl: '/views/services/service/usageHistory.html',
              controller:  'ServiceUsageHistoryController',
              windowClass: 'service-usage-history',
              resolve:     {
                  service: function () {
                      return $scope.service;
                  }
              }
          });

          modalInstance.result.then(function () {
              angular.element(document.body.querySelectorAll('.nvd3')).remove();
          })
      };

      // Load performance graph's data
      $scope.graphSliderConfig = graphConfig.graphSliderConfig;

      $scope.graphDataMapping = {
          "x":      "time",
          "y":      "value",
          "graph1": {"src": "internetTraffic", "visible": true},
          "graph2": {"src": "onNetTraffic", "visible": true},
          "graph3": {"src": "connectedUsers", "visible": true}
      };

      // obtain the service ID when it becomes available
      var serviceIdResolver = $q.defer(),
        serviceId = null;

      $scope.$watch('service', function (data) {
          if (data !== null) {
              serviceIdResolver.resolve(serviceId = data.id);
          }
      });

      $scope.fetchGraphData = function (data) {
          if (serviceId !== null) {
              // serviceId was obtained from the service request
              return $serverServices.getServicePerformanceGraphData(serviceId, data.range);
          }

          // serviceId is not available, wait until the service request returns it
          var graphDataResolver = $q.defer();
          serviceIdResolver.promise.then(function (serviceId) {
              $serverServices.getServicePerformanceGraphData(serviceId, data.range).then(graphDataResolver.resolve, graphDataResolver.reject);
          });
          return graphDataResolver.promise;
      };

      // configure donut chart
      $scope.xFunction = function () {
          return function () {
              return 0;
          };
      };

      $scope.yFunction = function () {
          return function (data) {
              return data;
          };
      };

      $scope.addMonthlyUsageLegend = function (usageGb, totalGb, quotaGb) {


          var pieLabels = d3.select($('.service-details .monthly-usage-chart .nv-pieLabels')[0]);

          pieLabels.attr('transform', 'translate(200, 75)');

          pieLabels.append('text')
            .attr('class', 'usage-gb')
            .attr('dy', '-0.2em')
            .style('text-anchor', 'middle')
            .text(usageGb + ' GB');

          pieLabels.append('text')
            .attr('class', 'usage-percentage')
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text((usageGb / totalGb * 100).toFixed() + '%');

          pieLabels.append('text')
            .attr('class', 'gb-total')
            .attr('transform', 'translate(45, 80)');

          pieLabels.append('text')
            .attr('class', 'service-day')
            .attr('transform', 'translate(-45, 80)')
            .style('text-anchor', 'end');

          $scope.updateMonthlyUsageLabels(quotaGb);
      };

      $scope.updateMonthlyUsageLabels = function (quotaGb) {


          var pieLabels = d3.select($('.service-details .monthly-usage-chart .nv-pieLabels')[0]);

          pieLabels.select('text.gb-total')
            .text($translate.instant('SERVICE.GB_TOTAL', {quotaGb: quotaGb}));

          pieLabels.select('text.service-day')
            .text($translate.instant('SERVICE.DAY_OF', {
                currentDay: $scope.service.monthlyUsage.currentDay,
                totalDays:  $scope.service.monthlyUsage.totalDays
            }));


          pieLabels.select('text.service-day')
            .text($translate.instant('SERVICE.DAY_OF', {
              currentDay: $scope.service.monthlyUsage.currentDay,
              totalDays:  $scope.service.monthlyUsage.totalDays
            }));


      };

      $scope.$on('language:change', function () {

          //don't change on page load , getMonthlyServiceUsage hasn't finished yet
          if ($scope.service.monthlyUsage) {
              $scope.updateMonthlyUsageLabels($scope.service.monthlyUsage.quotaGb);
          }

      });

      $scope.findGbTotal = function (arr) {
          try {
              var tot = 0;
              for (var i = 0; i < arr.length; i++) {
                  tot += arr[i];
              }
              return Math.round(tot * 10) / 10;
          } catch (err) {
              return "";
          }
      };

      $scope.getClient = function(){
        //console.log("wtf?!?!?");
        $window.open($scope.CONST.CLIENT_URL, '_blank');
      };


  }])

  .controller('ServicesDetailsSubitemsController', ['$rootScope', '$scope', 'serverServices', 'CONST', 'blockUI', function ($rootScope, $scope, $serverServices, CONST, blockUI) {
      $scope.showSubitems = false;
  }])

  .controller('ServicePropertiesController', ['$rootScope', '$scope', 'serverServices', 'CONST', 'blockUI', function ($rootScope, $scope, $serverServices, CONST, blockUI) {
      $scope.selectedOption = _.find($scope.service.choices, {'id': $scope.service.selectedId});

      $scope.edit = function () {
          $scope.service._selectedId = $scope.service.selectedId;

          if ($scope.goToDetails && _.isFunction($scope.goToDetails)) {
              $scope.goToDetails($scope.service);
          }
      };

      $scope.$watch('service.selectedId', function (newVal, oldVal) {
          $scope.selectedOption = _.find($scope.service.choices, {'id': newVal});
      });
  }])

  .controller('ServiceChoicePanelController', ['$rootScope', '$scope', 'serverServices', 'CONST', 'blockUI', function ($rootScope, $scope, serverServices, CONST, blockUI) {

      $scope.save = function () {

          var block = blockUI.instances.get('serviceChoiceBlock');
          block.start();

          var setServiceOption = serverServices.setServiceOption(
            $scope.service._id,
            $scope.service.type,
            {
              selectedId: $scope.service._selectedId
            });

          try {
            setServiceOption.then(function (response) {
                if(!response.status) {
                  $rootScope.$emit('global:error', {key: response.message || "ERRORS.NETWORK_ERROR"});
                  block.stop();
                } else {
                  $scope.service.selectedId = $scope.service._selectedId;

                  block.stop();

                  if ($scope.back && _.isFunction($scope.back)) {
                    $scope.back();
                  }              }
              })
              .catch(function(err) {
                  //console.log("servicePanel: $scope.save: err: " + err);
                  block.stop();
              });
          } catch(err) {
            console.log(err);
          }

      };

      $scope.selectChoice = function (choice) {
          $scope.service._selectedId = choice.id;
      };

      $scope.cancel = function () {
          if ($scope.back && _.isFunction($scope.back)) {
              $scope.back();
          }
      };

      $scope.restoreDefaults = function () {
          $scope.service._selectedId = $scope.service.defaultId;
      };
  }])

  .controller('ServiceUsageHistoryController', ['$scope', '$timeout', '$modalInstance', 'serverServices', 'service', function ($scope, $timeout, $modalInstance, serverServices, service) {

      $scope.chartWidth = 800;
      $scope.usageHistory = [];

      serverServices.getServiceUsageHistory()
        .then(function (response) {
            var values = [];
            response.forEach(function (d, i) {
                //console.log('getServiceUsageHistory d:', d);
                values.push({
                    "label": moment(d.time).format("MMM YYYY"),
                    "value": d.value
                });
            });
            // put the quota value in to the series data; this way the NVD3 bar chart can draw a horizontal line
            //values.push(service.monthlyUsage.quotaGb);

            $scope.chartWidth = Math.max($scope.chartWidth, response.length * 80);
            $scope.usageHistory = [{
                key:    '',
                "bar":  true,
                values: values
            }
                /*
                 ,{
                 key: '',
                 values: [[0, service.monthlyUsage.quotaGb], [0, service.monthlyUsage.quotaGb]]
                 }
                 */
            ];

            // https://github.com/krispo/angular-nvd3/blob/gh-pages/js/linePlusBarChart.js
            $scope.usageHistoryOptions = {
                chart: {
                    //type: 'linePlusBarChart',
                    type:   'discreteBarChart',
                    height: 325,
                    width:  750,
                    margin: //{top: 0, bottom: 35, left: 10, right: 0},
                                        {
                                            top:    20,
                                            right:  20,
                                            bottom: 60,
                                            left:   40
                                        },
                    x:                  function (d) {
                        return d.label;
                    },
                    y:                  function (d) {
                        return d.value;
                    },
                    showValues:         true,
                    staggerLabels:      true,
                    valueFormat:        function (d) {
                        return d3.format(',.1f')(d);
                    },
                    transitionDuration: 1000,
                    yAxis:              {
                        axisLabel:         'GB',
                        tickFormat:        d3.format(',.1f'),
                        axisLabelDistance: 45
                    }
                }
            };

            //console.log('getServiceUsageHistory usageHistory:', $scope.usageHistory);

            $timeout(function () {
                var chartContainer = $('.reveal-modal.service-usage-history .usage-chart');
                chartContainer.scrollLeft(chartContainer.width());
            });
        });

      $scope.xAxisTickFormatFunction = function () {
          return d3.format('.02f');
      };

      $scope.close = function () {
          $modalInstance.dismiss();
      };

  }])
  .directive('serviceDetailsPanel', function () {
      return {
          templateUrl: 'views/services/service/servicePanel.html',
          restrict:    'AE',
          //replace: true,
          controller:  'ServicesDetailsController',
          scope:       {
              service:                '=',
              openPerformanceHistory: '='
          }
      };
  })
  .directive('serviceProperties', function () {
      return {
          templateUrl: 'views/services/service/serviceProperties.html',
          restrict:    'AE',
          controller:  'ServicePropertiesController',
          scope:       {
              service:     '=',
              goToDetails: '='
          }
      };
  })
  .directive('serviceChoicePanel', function () {
      return {
          templateUrl: 'views/services/service/serviceChoicePanel.html',
          restrict:    'AE',
          controller:  'ServiceChoicePanelController',
          scope:       {
              service: '=',
              back:    '='
          }
      };
  });
