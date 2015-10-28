'use strict';

angular.module('cv.services')

.controller('DevicesDetailsController', ['$rootScope', '$scope', '$q', '$translate', 'serverServices', 'graphConfig', 'serverDevices', '$window', 'CONST', function ($rootScope, $scope, $q, $translate, $serverServices, graphConfig, $serverDevices, $window, CONST) {

    $scope.monthlyUsageBreakdown = [];
    $scope.sitePerformanceHistory = [];
    $scope.CONST = CONST;

    $scope.setAddress = function(location, bottom) {

      if(!location) {
        return;
      }

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

    var loadSiteMonthlyUsage = function() {
        $serverServices.getMonthlyDeviceUsage($scope.site.devices).then(function(response) {
            var usageGb = parseInt(response.usageGb),
            availableGb = response.quotaGb - usageGb;
            $scope.monthlyUsage = [usageGb, availableGb];

            setTimeout(function() {
                $scope.addMonthlyUsageLegend(usageGb);
            }, 150);
        });
    };

    $scope.getClient = function(){
        $window.open($scope.CONST.CLIENT_URL, '_blank');
    };

    // Load performance graph's data
    $scope.graphSliderConfig = graphConfig.graphSliderConfig;

    $scope.graphDataMapping = {
        "x":"time",
        "y":"value",
        "graph1":{"src":"internetTraffic", "visible":true},
        "graph2":{"src":"onNetTraffic", "visible":false},
        "graph3":{"src":"connectedUsers", "visible":false}
    };

    // obtain the devices when the site becomes available
    $scope.$watch('site', function(data) {
        if (data) {
            loadSiteMonthlyUsage();
            $scope.$broadcast('graph:reload');
        }
    });

    $rootScope.$on('marker:close', function(e, data) {
        $scope.onLeave();
    });

    $scope.fetchGraphData = function(data){
        if ($scope.site !== undefined) {
            // site was already obtained
            var deviceIds = [];
            $scope.site.devices.forEach(function(device) {
            	deviceIds.push(device.name);
            });
            return $serverDevices.getDevicePerformanceGraphData(deviceIds, data.range);
        }

        // site is not available yet
        var deferred = $q.defer();
        deferred.reject({});
        return deferred.promise;
    };

    // configure donut chart
    $scope.xFunction = function() {
        return function() {
            return 0;
        };
    };

    $scope.yFunction = function() {
        return function(data) {
            return data;
        };
    };

    $scope.addMonthlyUsageLegend = function(usageGb) {
        var pieLabels = d3.select($('.devices-details .monthly-usage-chart .nv-pieLabels')[0]);
        pieLabels.append('text')
            .attr('transform', 'translate(35, -45)')
            .text($translate.instant('SERVICE.THIS_LOCATION', {'locationUsageGb': usageGb}));
    };

}])
.directive('devicesDetailsPanel', function() {
	return {
		templateUrl: 'views/services/devices/devicesPanel.html',
		restrict: 'AE',
		replace: true,
		controller: 'DevicesDetailsController',
		scope: {
			service: '=',
			site: '=',
			openPerformanceHistory: '=',
			showDeviceDetails: '&',
			onBack: '&',
            onLeave: '&'
		}
	};
});
