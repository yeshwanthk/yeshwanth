'use strict';

angular.module('cv.services', ['cv.server.services', 'cv.server.devices', 'cv.performanceGraph', 'blockUI'])

  .controller('ServicesController', ['$window', '$rootScope', '$scope', '$modal', 'serverServices', 'serverDevices', 'supportedDeviceTypes', 'CONST', 'blockUI', function ($window, $rootScope, $scope, $modal, $serverServices, $serverDevices, supportedDeviceTypes, CONST, blockUI) {
      $scope.CONST = CONST;
      $scope.sites = {};
      $scope.service = null;
      $scope.performanceHistory = [];
      $scope.activePanel = 0;

      $scope.supportedDeviceTypes = supportedDeviceTypes;
      $scope.selectedDevice = null;
      $scope.devices = null;
      $scope.serviceOptions = null;


      // Init spinners
      var mainPanelBlock = blockUI.instances.get('servicesMapbox');
      mainPanelBlock.start();
      var monthlyUseBlock = blockUI.instances.get('serviceMonthlyUseBreakdown');
      monthlyUseBlock.start();
      var topUsageBlock = blockUI.instances.get('serviceTopUsage');
      topUsageBlock.start();
      var performanceGraphBlock = blockUI.instances.get('performanceGraphBlock');
      performanceGraphBlock.start();
      var bucketsBlock = blockUI.instances.get('bucketsBlock');
      bucketsBlock.start();

      $rootScope.$broadcast('app:changePageTitle', 'DASHBOARD.HEADER_SERVICES');

      //$serverServices.getGraphData(100);

      $scope.$on('marker:open', function (e, data) {

        $rootScope.$broadcast('servicePanelState', 0);

          var siteId = data.location.lat + ',' + data.location.lng;
          $scope.site = $scope.sites[siteId];
          $scope.activePanel = 1;
      });

      $scope.getDeviceState = function(status) {
        if(status == 'online') {
          return 'normal';
        }
        else if(status == 'offline') {
          return 'critical';
        }
        else {
          return 'minor';
        }
      };

      $scope.checkDeviceStatus = function (device, status){

        var ret = false;

        if(!device && !status) ret = true;

        if(device) {
          ret = (device.status == status);
        }

        return ret;
      };

      $scope.checkDeviceSelected = function(device){

        if(!device){
          return;
        }
        return $scope.selectedLowerName === device.name;
      };

      $scope.showDeviceDetails = function (chosenDevice) {

        $rootScope.$broadcast('servicePanelState', 0);

        for (var i in $scope.devices) {
            if (angular.equals(angular.lowercase(chosenDevice.name), angular.lowercase($scope.devices[i].name))) {

                $scope.selectedLowerName = angular.lowercase($scope.devices[i].name);
                $scope.selectedDevice = $scope.devices[i];
                $scope.activePanel = 2;
            }
        }
      };



    $scope.onBack = function () {

        $rootScope.$broadcast('servicePanelState', 0);

          $scope.activePanel = Math.max($scope.activePanel - 1, 0);

          // close the marker tooltip if the service details panel is shown
          if ($scope.activePanel === 0) {
              $scope.$parent.$broadcast('map:marker:closePopup');
          }
      };

      $scope.onLeave = function () {
        $rootScope.$broadcast('servicePanelState', 0);
          $scope.activePanel = 0;
      };

      $serverServices.getAllServices().then(function (service) {

          var ol = [];
          for(var e in service.optionList) {
            var option = service.optionList[e];
            ol[option.orderIndex-1] = option;
          }
          service.optionList = ol;

          $scope.service = service;
          $scope.devices = service.devices;

          $scope.service._blockMap = false;

          // Remove spinner - Top Usage
          var topUsageBlock = blockUI.instances.get('serviceTopUsage');
          topUsageBlock.stop();

          // Remove spinner - Services
          var monthlyUseBlock = blockUI.instances.get('servicesMapbox');
          monthlyUseBlock.stop();

          // create sites by grouping devices
          // This call returns an array which will only have one service in it (response[0])

          var nDevicesNoLocation = 0;

          for(var e in $scope.devices) {
              if ($scope.devices.hasOwnProperty(e)) {
                  var device = $scope.devices[e];

                  // If the device has an address(geolocation), then we can show it on the map
                  if (device.location != null && !!device.location.la && !!device.location.lo) {
                      var siteId = device.location.la + ',' + device.location.lo;

                      if ($scope.sites[siteId] === undefined) {
                          $scope.sites[siteId] = {
                              id: siteId,
                              location: device.location,
                              address: device.address,
                              devices: [],
                              issue: false
                          };
                      }

                      // What is the status of the device?
                      //console.log('getAllServices device.status:', device.status);
                      if (device.status != "online") {
                          // Not online, then show it with error highlight
                          $scope.sites[siteId].issue = true;
                      }
                      // Push this device to the site list
                      $scope.sites[siteId].devices.push(device);
                  } else {
                      nDevicesNoLocation++;
                  }
              }
          };

          if(nDevicesNoLocation == $scope.devices.length) {
              $rootScope.$emit('map:block', 'no_location', 5);
          }

          $serverServices.getServicePerformanceGraphData(service.id).then(function (response) {

              // Remove spinner - Top Usage
              var performanceGraphBlock = blockUI.instances.get('performanceGraphBlock');
              performanceGraphBlock.stop();
              //console.log("Removed performance graph data spinner");

              $scope.performanceHistory = response;

              // put the connected users quota into the first item of the list
              var connectedUsers = $scope.performanceHistory.connectedUsers;
              if (connectedUsers.length > 0) {
                  connectedUsers[0].quota = 14;
              }
          });

          $serverServices.getServiceOptions(service.id).then(function(response) {
            bucketsBlock.stop();
            if(!!response) {
              $scope.serviceOptions = response;
            } else {
                console.error('getServiceOptions: empty response');
            }
          });
      });

      $scope.openPerformanceHistory = function (data) {
          var modalInstance = $modal.open({
              templateUrl: '/views/services/performancehistory.html',
              controller: 'ServicesPerformanceHistoryController',
              windowClass: 'performance-history',
              resolve: {
                  graphData: function () {
                      return data.graphData;
                  },
                  sliderConfig: function () {
                      return angular.copy(data.sliderConfig);
                  },
                  graphDataMapping: function () {
                      return data.graphDataMapping;
                  },
                  onFetchGraphData: function () {
                      return data.onFetchGraphData;
                  }
              }
          });
      };

      $scope.setAddress = function(location, bottom) {
        if(!location) return;

        //var index = bottom == true ? 1 : 0;
        //var vals = address.split(',');
        //return vals[index];

        var add = "";
        if(!bottom) {
          if(location.address1) {
            add = location.address1;
          }
          else {
            add = location.address;
          }
        } else {
          if(location.zip) {
            add = location.zip + " " + location.city + ", " + location.country;
          }
        }

        return add;
      };

  }])
  .controller('ServicesMapController', ['$scope', '$http', '$rootScope', function ($scope, $http, $rootScope) {

      $scope.suggestions = [];

      $scope.isEmpty = function(item) {
          return _.isEmpty(item);
      };
      // store all reasons for map blocking along with reason priorities
      $scope.mapBlockReasons = {};

      // most important (highest priority) reason for blocking the map,
      // chosen from mapBlockReasons
      $scope.usedBlockReason = '';

      $rootScope.$on('map:block', function(event, reason, priority) {
        if(!reason) {
            return;
        }
        if(!priority) {
            priority = 1;
        }

        // store reason as akey and as a property also to be able to get it from a template
        $scope.mapBlockReasons[reason] = {reason: reason, priority: priority};
      });

      $rootScope.$on('map:unblock', function(event, reason) {
          delete $scope.mapBlockReasons[reason];
      });

      $scope.$watch('mapBlockReasons', function(newValue) {
          if(_.isEmpty(newValue)) {
              $scope.usedBlockReason = '';
              return;
          }

          $scope.usedBlockReason = _.max(newValue, 'priority').reason
      }, true);

      $scope.findAddress = function (location) {
          $scope.suggestions.length = 0;
          $http.get(CONST.MAPQUEST_URL + CONST.MAPQUEST_API + '&location=' + location).then(function (data) {
              var locations = data.data.results[0].locations;
              for (var i = 0; i < locations.length; i++) {
                  $scope.suggestions.push(locations[i]);
              }
          });
      };

      $scope.goToAddress = function (location, quality) {
          var mapScope = angular.element('#mapbox-test').scope();

          if (quality == "STREET")
              mapScope.map.setView([location.lat, location.lng], 19);
          else if (quality == "POINT")
              mapScope.map.setView([location.lat, location.lng], 20);
          else if (quality == "ZIP")
              mapScope.map.setView([location.lat, location.lng], 15);
          else
              mapScope.map.setView([location.lat, location.lng], 12);
      };

      $scope.showDevice = function (device) {
          console.dir("Device: " + device.location.la);
      };

      // block map by event
//      $rootScope.$on('map.content.block', function(event, reason) {
//
//      })
  }])
  .controller('ServicesPerformanceHistoryController', ['$q', '$scope', '$modalInstance', 'graphData', 'graphDataMapping', 'graphConfig', 'onFetchGraphData', '$rootScope',
      function ($q, $scope, $modalInstance, graphData, graphDataMapping, graphConfig, onFetchGraphData, $rootScope) {

          $scope.graphDataMapping = graphDataMapping;
          $scope.graphSliderConfig = graphConfig.graphSliderConfig;

          $scope.fetchGraphData = function (data) {
              if ($scope.graphData === undefined) {
                  var deferred = $q.defer();
                  deferred.resolve($scope.graphData = graphData);
                  return deferred.promise;
              }

              return onFetchGraphData(data);
          };

          $scope.updateGraphPosition = function (range) {
              //console.log(range);
          };

          $scope.close = function () {
              $modalInstance.dismiss();
          };

          // fix Foundation range slider pointer falling out of range
          setTimeout(function () {
              $('.performance-history.reveal-modal').foundation('reflow');
          }, 0);
      }])

.factory('graphConfig', function () {

      var  graphSliderConfig =  {
          "currentValue":  2,
          "startValue":    1,
          "stopValue":     5,
          "stepValue":     1,
          "scaleFunction": function (value) {
              var scales = {
                  '1': 3,
                  '2': 24,
                  '3': 24 * 7,
                  '4': 24 * 7 * 4,
                  '5': 24 * 7 * 4 * 3
              };
              return scales[value];
          },
          "momentFormat":  function (value) {
              var formatting = {
                  '1': 'LTS',
                  '2': 'LT',
                  '3': 'dd',
                  '4': 'Do',
                  '5': 'MMM'
              };
              return formatting[value];
          }
      };


      return {
        graphSliderConfig: graphSliderConfig
      }
  });
