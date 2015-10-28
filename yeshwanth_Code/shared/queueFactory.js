'use strict';

angular.module('appVPN')

    // Create queue for API Calls
    .factory('$queueFactory', ['$rootScope', 'CONST', 'serverQueue', '$timeout', '$translate', '$q', '$state', '$interval', function($rootScope, CONST, serverQueue, $timeout, $translate, $q, $state, $interval) {

      var origTimeoutVal = 5000;
      var currTimeoutVal = origTimeoutVal;
      var started = false;
      $rootScope.creatingService = false;

      $rootScope.$on('queue:start', function () {
          start();
      });

      function apiRouteMap(apiName) {
        var map = {
          "createService":           "root.dashboard",
          "purchaseDevice" :         "root.dashboard",
          "modifyService" :          "root.dashboard",
          "deleteService":           "root.ordering",
          "setServiceOption":        "root.services",
          "addDevice":               "root.devices",
          "setDeviceInfo":           "root.devices",
          "hotswapDevice":           "root.devices",
          "deleteDevice":            "root.devices",
          "setAdvancedDeviceConfig": "root.devices",
          "addUsers":                "root.users",
          "deleteUsers":             "root.users",
          "updateUsersStatuses":     "root.users"
        };
        return map[apiName];
      }

      var currentQ;
      function getCompletedRoute() {
        return apiRouteMap(currentQ.apiId);
      }

      //clear completed queues on login before making new requests
      //response if queue empty: {
      //   "message": "empty",
      //    "status": "ok"
      //}
      function clearStatus() {
          //console.log('clearStatus CONST.ASYNC:', CONST.ASYNC);
          if(!CONST.ASYNC) {
            var deferred = $q.defer();
            deferred.resolve();
            return deferred.promise;
          }

          return serverQueue.getQueueStatus()
            .then(function(status) {
                if (status.hasOwnProperty('apiId')) {
                    $rootScope.creatingService = (status.apiId === "createService" &&
                    (status.qStatus === "new" || status.qStatus === "pending"));

                    if ((status.qStatus === 'completed' || status.qStatus === 'error') && !status.acknowledged) {
                        reset(status.apiId);
                        return serverQueue.qAck("acknowledged", status.qid);
                    } else {
                        return status;
                    }
                } else {
                    //queue is empty; response received is {message: empty, status: ok}
                    return status;
                }
          }, function(err){
              //console.log('disable CONST.ASYNC');
              // this is ok, if the qStatus API does not exist
              // turn off ASYNC
              CONST.ASYNC = false;

              var deferred = $q.defer();
              deferred.reject();
              return deferred.promise;
          });
      }

      function start(orgRes) {

          var deferred = $q.defer();

          //console.log('start CONST.ASYNC:', CONST.ASYNC);
          if(!CONST.ASYNC) {
            deferred.resolve(orgRes);
            return deferred.promise;
          }

          var displayAlert = function(state, key) {
              $rootScope.$emit('alert:show', {
                  state: state,
                  key:   key,
                  show:  {
                      viewButton:  true,
                      closeButton: true
                  }
              });
          };

          var refreshAndRerouteAfterDelay = function(apiId) {
              $timeout(function() {

                  //don't allow editing again until after refresh
                  reset(apiId);
                  if (apiId === "createService") {
                      $state.go($state.current, {}, {reload: true});
                  } else {
                      var route = apiRouteMap(apiId);
                      if ($state.current.name == route) {
                          $state.go($state.current, {}, {reload: true});
                      }
                  }
              }, 6000);
          };

          var pollStatus = function() {

              //this checkStatus only happens after an item has been queued via a queue API,
              //therefore doesn't deal with the alternate format API when the queue is empty ('message': 'empty')
              checkStatus(orgRes).then(function(finalRes) {

                  if(finalRes.qStatus === "new" || finalRes.qStatus === "pending") {

                      //don't over-poll, but still check not less than every 2 mins
                      currTimeoutVal = Math.min(currTimeoutVal * 2, 120000);
                      $timeout(pollStatus, currTimeoutVal);

                  } else if (finalRes.qStatus === 'completed') {

                      if (finalRes.completedResponseData &&
                        finalRes.completedResponseData.hasOwnProperty('status')) {
                          if (finalRes.completedResponseData.status == 1 ||
                            String(finalRes.completedResponseData.status).toLowerCase() === 'ok') {
                              var successKey = "QUEUE.COMPLETE." + finalRes.apiId.toUpperCase();
                              displayAlert('success', successKey);
                              refreshAndRerouteAfterDelay(finalRes.apiId);
                              deferred.resolve(finalRes.completedResponseData);
                          } else {
                              var errorKey = "QUEUE.ERROR." + finalRes.apiId.toUpperCase();
                              refreshAndRerouteAfterDelay(finalRes.apiId);
                              displayAlert('error', errorKey);
                              deferred.reject(finalRes.completedResponseData);
                          }
                      } else {
                          // TODO - original API response does not include status
                          // (eg deleteDevice which just returns an id)
                          // so need to just assume success
                          var successKey = "QUEUE.COMPLETE." + finalRes.apiId.toUpperCase();
                          displayAlert('success', successKey);
                          refreshAndRerouteAfterDelay(finalRes.apiId);
                          deferred.resolve(finalRes.completedResponseData || orgRes);
                      }

                  } else {
                      refreshAndRerouteAfterDelay(finalRes.apiId);
                      console.error('unexpected qStatus returned');
                  }
              },
                function (errorRes) {
                    var errorKey = (errorRes.apiId) ?
                                   ("QUEUE.ERROR." + errorRes.apiId.toUpperCase()) :
                                   "QUEUE.ERROR_MSG";
                  $rootScope.$emit('alert:show', {
                      key: errorKey,
                      state: 'error',
                      show:   {
                          closeButton: true
                      }
                  });
                    refreshAndRerouteAfterDelay(errorRes.apiId);
                    deferred.reject(errorRes);
              });
          };
          pollStatus();

          return deferred.promise;
      }

      function checkStatus(orgRes) {

        started = true;

        var deferred = $q.defer();
        var apiId;

        console.log('checkStatus CONST.ASYNC:', CONST.ASYNC);
        if(!CONST.ASYNC) {
          deferred.resolve(orgRes);
          return deferred.promise;
        }

        serverQueue.getQueueStatus().then(function(res) {

            //console.log('res:', res);
            currentQ = res;

            apiId = res.apiId;
            if(apiId) {

                var msg = "QUEUE.MSG." + apiId.toUpperCase();
                var submsg = res.eta > 0 ? $translate.instant('QUEUE.BOT_MSG') + ' ' + etaStr : '';

                $rootScope.queue.msg = msg;

                var key = "QUEUE.PROGRESS." + apiId.toUpperCase();
                $rootScope.$emit('alert:show', {
                    key:    key,
                    submsg: submsg,
                    state: 'pending',
                    show:   {
                        viewButton: false,
                        closeButton: false
                    }
                });

                if (res.eta) {
                    //TODO - add to pending alert once server adds support to send it
                    var etaDuration = moment.duration(res.eta, "seconds");
                    var etaStr = etaDuration.humanize();
                }

                if(res.qStatus === "completed") {
                    serverQueue.qAck("acknowledged", res.qid)
                      .then(function() {
                          deferred.resolve(res);
                      }, function() {
                          //console.log('not acknowledged...');
                          deferred.reject(res);
                      });
                }
                else if (res.qStatus === "error") {
                    serverQueue.qAck("acknowledged", res.qid);
                    deferred.reject(res);
                }
                else if (res.qStatus === "new" || res.qStatus === "pending") {
                    $rootScope.queue.disableEdit = true;
                    deferred.resolve(res);
                }
            } else {
                //TODO - sometimes this is erroring because the server returns a different API
                //response in some edge situation (empty queue is covered by always running
                //clearStatus before posting to any of the queueing APIs)
                deferred.reject(res);
            }

          })
          .catch(function (error) {
              deferred.reject(error);
          });

        return deferred.promise;
      }

      function reset(apiId) {
            currTimeoutVal = origTimeoutVal; // Reset back to 5 secs
            $rootScope.queue.disableEdit = false;
            started = false;
          if (apiId === "createService") {
              $rootScope.creatingService = false;
          }
        }

      function cancel(sendAct) {

          reset();
          $rootScope.$emit('alert:hide');

          if (sendAct) {
              return serverQueue.qAck("cancel", currentQ.qid);
          }

      }

      return {
          start: start,
          cancel: cancel,
          clearStatus: clearStatus,
          getCompletedRoute: getCompletedRoute
      };

    }]);
