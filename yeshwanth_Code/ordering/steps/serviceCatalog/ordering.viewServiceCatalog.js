'use strict';

angular.module('cv.ordering.viewServiceCatalog', [])

  .controller('ViewServiceCatalogController', ['serverOrdering', 'serverCore', 'ccCurrencySymbol', '$modal', '$state', '$scope', '$timeout', 'confirmationModal',
      function (serverOrdering, serverCore, ccCurrencySymbol, $modal, $state, $scope, $timeout, confirmationModal) {

          //builds the offer checkmark grid
          $scope.$watch('serviceList', function (newValue, oldValue) {

              //check present to solve bug in Firefox where watch is provided with
              //identical new and old value the first time, and so never populates
              var hasRun = false;

              $scope.existingSubscription = {
                  "hasExistingSubscription": false
              };
              if ($scope.serviceList && $scope.serviceList.offers && (newValue !== oldValue || hasRun === false)) {
                  hasRun = true;

                  //build feature table
                  var offerMatrix = [];
                  var offerList = $scope.serviceList.offers;
                  var featureList = $scope.serviceList.features;

                  for (var offerIndex = 0; offerIndex < offerList.length; offerIndex++) {

                      offerMatrix[offerIndex] = angular.copy(offerList[offerIndex]);
                      var offer = offerMatrix[offerIndex];


                      //if the offer has a minServicePrice, then price will not be
                      //added to the total at all - but we're just creating it for
                      //passing through to the productPanel directive, for display only
                      if (offer.hasOwnProperty('minServicePrice')) {
                          offer.price = Number(offer.minServicePrice);
                      } else {
                          offer.price = Number(offer.price);
                      }

                      /* if any services are currently subscribed, at the end we will
                       call the changeService rather than createService API
                       */
                      if (offer.subscribed) {
                          $scope.existingSubscription = {
                              "hasExistingSubscription": true,
                              "price":                   offer.price,
                              "existingSubscriptionId":  offer.offerId
                          };

                      }

                      //clear out features - we will replace with full info
                      offer.features = {};
                      for (var featureIndex = 0; featureIndex < featureList.length; featureIndex++) {

                          var featureId = featureList[featureIndex].featureId;

                          //make a key under built offers by the featureId
                          offer.features[featureId] = {};
                          offer.features[featureId].name = featureList[featureIndex].name;
                          offer.features[featureId].featureId = featureList[featureIndex].featureId;

                          //cycle through every feature in the original offers array to check whether it matches the
                          // feature Id
                          offer.features[featureId].presence = (function () {
                              for (var i = 0; i < offerList[offerIndex].features.length; i++) {
                                  if (offerList[offerIndex].features[i] === featureId) {
                                      return true;
                                  }
                              }
                              return false;
                          })();

                      }
                  }

                  $scope.serviceIdMatrix = offerMatrix;
                  $scope.featureList = featureList;
              }
          });

          //Confirmation to delete currently subscribed service

          $scope.unsubscribeService = function (service) {

              confirmationModal({
                  headerText: 'ORDER.SERVICE.UNSUBSCRIBE-MODAL.HEADER',
                  bodyText:   'ORDER.SERVICE.UNSUBSCRIBE-MODAL.UNSUBSCRIBE_MESSAGE',
                  action:     serverOrdering.deleteService.bind(this)
              }).then(function (response) {
                  if (response.status === 'ok' || response.status === 1) {
                      service.subscribed = null;
                      $scope.existingSubscription = {
                          "hasExistingSubscription": false
                      };
                      $cookieFactory.setServerData('serviceId', null)
                  }
                  $state.go('root.ordering');
              });
          };

          //temporary logic until the backend does this for us...
          var blockDowngradeModal = function () {
              confirmationModal({
                  bodyText:   "ORDER.SERVICE.DOWNGRADE_UNAVAILABLE",
                  hideCancel: true
              })
          };

          $scope.selectService = function (data) {
              if (data.value.price < $scope.existingSubscription.price) {
                  blockDowngradeModal();
              } else {
                  //regular step that can be put back into HTML once temp logic no longer required
                  $scope.onStepCompleted({"data": data});
              }
          };
      }])
  .directive('orderingViewServiceCatalog', function () {
      return {
          templateUrl: "views/ordering/steps/serviceCatalog/ordering.viewServiceCatalog.html",
          restrict:    'AE',
          replace:     true,
          controller:  "ViewServiceCatalogController",
          scope:       {

              serviceList:     "=",
              currency:        '@',
              chargeUnit:      '@',
              onStepCompleted: "&"
          }
      };
  });
