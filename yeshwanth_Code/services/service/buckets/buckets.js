'use strict';

angular.module('cv.services')

  .controller('BucketsController', ['$scope', 'serverServices', 'blockUI', '$rootScope', function($scope, serverServices, blockUI, $rootScope) {

    var bucketsBlock = blockUI.instances.get('bucketsBlock');

    $scope.nApplications = null;
    $scope.showAdvanced = false;
    $scope.totalWeight = 0;
    $scope.unusedWeight = 0;

    // toggle bandwidth
    $scope.enableBandwidth = function() {
      $scope.models.enabled = !$scope.models.enabled;
    };

    // keep track of currently dragged item to prevent putting an item back to
    // the same bucket - it causes an ng-repeat issue when
    // iterating over a list of numbers that are contained in a bucket
    $scope.currentDraggedItem = null;

    $scope.isSameBucket = function(item, listName) {
      return _.contains(_.find($scope.models.buckets, {'name': listName}).contains, item);
    };

    $scope.onDragged = function(item) {
      $scope.currentDraggedItem = item;
    };

    $scope.getItemName = function(item) {
      return $scope.models.items[item].name;
    };

    $scope.updateTotalWeight = function() {
      var _accumulator = 0;
      $scope.totalWeight = _.reduce($scope.models.buckets, function(sum, bucket) {
        return sum + bucket.weight;
      }, _accumulator);

      $scope.unusedWeight = Math.max(0, 100 - $scope.totalWeight);
    };

    $scope.restoreDefaults = function() {
      var models = $scope.models;
      for(var key in models.buckets) {
        if(models.buckets.hasOwnProperty(key) ) {
          if(!models.defaults.hasOwnProperty(key)) {
            console.error('Property', key, 'do not exist in defauts');
            continue;
          }
          models.buckets[key].contains = _.clone(models.defaults[key].contains);
          models.buckets[key].weight = models.defaults[key].weight;
        }
      }
      $scope.updateTotalWeight();
    };

    $scope.save = function(buckets) {

      $scope.service.enabled = $scope.models.enabled === true ? $scope.models.enabled : $scope.service.enabled;

      bucketsBlock.start();
      serverServices.setServiceOption($scope.service._id, $scope.service.type, buckets)
        .then(function(response) {
          if(!response.status) {

            $rootScope.$emit('global:error', {key: response.message || 'ERRORS.NETWORK_ERROR'});

            bucketsBlock.stop();
          } else {
            // apply the change to value in parent
            $scope.service.buckets = $scope.models.buckets;
            bucketsBlock.stop();

            if($scope.back && _.isFunction($scope.back)) {
              $scope.back();
            }

            $rootScope.$broadcast('updateBars');
          }
        });
    };

    $scope.sliderChange = function(listName) {
      var bucket = _.find($scope.models.buckets, {'name': listName});
      //console.log('sliderChange bucket:', _.cloneDeep(bucket));
      if(!bucket.weight) {
        bucket.weight = 1;
      }
      //$scope.models.buckets[listName].weight = $scope.models.buckets[listName].weight | 0
      $scope.updateTotalWeight();
    };

    $scope.cancel = function() {

      $scope.models = _.cloneDeep($scope.service);

      $scope.updateTotalWeight();

      if($scope.back && _.isFunction($scope.back)) {
        $scope.back();
      }
    };
  }])

  .directive('bucketsPanel', function() {
    return {
      templateUrl: 'views/services/service/buckets/buckets.html',
      restrict: 'AE',
      replace: true,
      controller: 'BucketsController',
      scope: {
        service: '=',
        back: '='
      },
      link: function($scope) {
        // do a deep copy to apply changes only when user hits 'save'
        $scope.models = _.cloneDeep($scope.service);
        $scope.nApplications = _.size($scope.models.items);
        //console.log('bucketsPanel models:', _.cloneDeep($scope.models));
      }
    };
  });
