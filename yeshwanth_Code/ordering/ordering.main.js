'use strict';

angular.module('cv.ordering.main',
  ['cv.ordering.shared',
      'cv.ordering.animation',
      'cv.ordering.header',
      'cv.ordering.productPanel',
      'cv.ordering.viewServiceCatalog',
      'cv.ordering.viewSiteProfile',
      'cv.ordering.viewOptionList',
      'cv.ordering.viewDevices',
      'cv.ordering.viewShipping',
      'cv.ordering.viewReviewOrder'])
  .controller('OrderingMainController', ['$document', 'blockUI', '$compile', '$modal', 'currencyConversionFactory', '$rootScope', '$state', '$stateParams', 'serverOrdering', '$scope', '$timeout', '$translate', 'LanguageFactory', 'installOptionsFactory', 'buildOrderFactory', 'confirmationModal', '$cookieFactory', 'confirmProgressLoss', 'orderingAnimation', 'CONST',
      function ($document, blockUI, $compile, $modal, currencyConversionFactory, $rootScope, $state, $stateParams, serverOrdering, $scope, $timeout, $translate, LanguageFactory, installOptionsFactory, buildOrderFactory, confirmationModal, $cookieFactory, confirmProgressLoss, orderingAnimation, CONST) {


          //make sure currency appears in the right place on load (angular loads in browser locale first by default)
          LanguageFactory.setDynamicLocale($cookieFactory.getServerData('lang'));

          $scope.orderingShowTaxWarning = CONST.ORDERING_SHOW_TAX_WARNING || null;

          // Get the service id from the cookie so we can decide whether or not we should show the device purchase link
          $scope.hasService = $cookieFactory.getServerData("serviceId");

          $rootScope.$broadcast('app:changePageTitle', 'DASHBOARD.HEADER_ORDERING');
          //for population initial view
          $scope.serviceList = {};

          //currency explicitly set to null for purposes of orderDevice.js; refer there for more info
          $scope.currency = null;

          //provide spinner for waiting whilst getting server info
          var orderingBlock = blockUI.instances.get('orderingBlock');

          //set up warnings to prevent leaving ordering state without confirmation if progressed
          confirmProgressLoss.registerLeaveWatches($scope, orderingBlock, getOffers.bind(this));


          //===================================================
          // getOffers API call
          //===================================================

          function getOffers() {
              orderingBlock.start();
              $scope.selectedService = {selectedOptions: {}};
              $scope.title = $translate.instant("ORDER.SERVICE.TITLE");

              serverOrdering.getOffers().then(function (response) {
                  orderingBlock.stop();
                  if (response) {
                      // Make sure we do get at least an offer
                      if (response.offers && response.offers.length > 0) {
                          $scope.serviceChargeUnit = response.chargeUnit;
                          $scope.currency = currencyConversionFactory.convert(response.currency);
                      }
                      $scope.serviceList = response;
                  } else {
                      console.error('no response received from server getOffers API')
                  }
              });
              //important for calculating panel heights correctly later
              //and keeping ordering-scrollable-container horizontal scrollbar visible
              $timeout(function () {
                  orderingAnimation.adjustWindowHeight();
              });
          }

          //run on first load
          getOffers();

          //===========================================================================================
          // getRecommendations API call (run midway from main switch statement, or on language change)
          //===========================================================================================

          function getRecommendations(data) {
              if ($scope.existingSubscription.hasExistingSubscription) {
                  data.value.oldOfferId = $scope.existingSubscription.existingSubscriptionId;
              }
              var siteInfo = data.value;
              var promise = serverOrdering.getRecommendations(siteInfo).then(function (response) {

                  /* Pass the service options to the ng-repeat so we can generate option(s) dynamically
                   and ensure that the key matches angular's default sorting order */
                  $scope.optionList = [];
                  titleArray = ['service', 'siteProfile', 'devicePurchase', 'shipping', 'review'];
                  var newTitles = [];

                  //clear out allDevices so shipping and device pages reset accordingly
                  $scope.allDevices = null;

                  $scope.installOptions = response.installOptions;
                  if (response.recommendedDevices) {
                      $scope.deviceChargeType = {data: response.recommendedDevices.chargeType};
                      $scope.deviceChargeUnit = {data: response.recommendedDevices.chargeUnit};
                  } else {
                      //still create these so that devicePurchase can propogate values up to them when run
                      $scope.deviceChargeType = {data: null};
                      $scope.deviceChargeUnit = {data: null};
                  }
                  //console.log('optionList response from server after middle layer');
                  //console.log(response.optionList);
                  //sort titles by orderIndex
                  response.optionList.sort(function (a, b) {
                      return a.orderIndex - b.orderIndex;
                  });

                  //console.log('installOptions:', $scope.installOptions);


                  // add titles to list

                  for (var i = 0; i < response.optionList.length; i++) {
                      newTitles.push(response.optionList[i].title)
                  }

                  //now we have all the information, we can generate the array
                  for (var i = 0; i < newTitles.length; i++) {
                      titleArray.splice(2 + i, 0, newTitles[i]);
                  }

                  // Pass the recommended devices to the device directive, if the user has specified to see them
                  if (siteInfo.showRecommendations) {
                      $scope.recommendedDevices = response.recommendedDevices;
                  } else {
                      //clear it out, the user might go back and then skip recommendations
                      $scope.recommendedDevices = [];
                  }
                  $scope.optionList = response.optionList;
              });
              return promise;
          }


          //=================================================================
          // Track current step in the process - we know the first and last group
          // and will insert the selectedOptions dynamically after 'siteProfile' when we receive them
          //=================================================================

          var animateForwards = function (data, dontUpdateTitle) {
              orderingAnimation.startPanelTransition(data.widgetInfo, data.event, $scope).then(function () {
                  //this promise resolves as soon as the correct page number is set,
                  //to make sure we take the right title and display it a little early
                  if (!dontUpdateTitle) {
                      updatePageTitleAndTotals(orderingAnimation.getCurrentPage())
                  }
              });
          };

          var titleArray = ['service', 'siteProfile', 'devicePurchase', 'shipping', 'review'];

          //initial value for service page
          $translate("ORDER.SERVICE.TITLE").then(function (translation) {
              $scope.title = translation;
          });
          $scope.isOrderingSteps = true;
          $scope.isReviewStep = false;

          // Use this to keep track of the current view index
          // We need this variable to show/hide device purchase link in the service catalog page
          orderingAnimation.initialize();
          $scope.currentStepIndex = 0;
          //console.log('currentStepIndex:', $scope.currentStepIndex);

          // Animation's transition factory is tracking the current view index
          // so we can just watch it and update the current step index when it changes

          function updatePageTitleAndTotals(newStepIdx) {
              $scope.currentStepIndex = newStepIdx;
              if (newStepIdx > titleArray.indexOf('siteProfile') && newStepIdx < titleArray.indexOf('devicePurchase')) {
                  //use title supplied from server for dynamic options
                  $scope.title = titleArray[newStepIdx];
              }
              else {
                  $scope.title = $translate.instant("ORDER." + titleArray[$scope.currentStepIndex].toUpperCase() + ".TITLE")
              }

              //clear out options made after the point to where the user has navigated;
              //this is used for the purposes of resetting the serviceTotal and therefore the
              //appearance of '+' in the productPanel directive if the user goes back to the first option

              for (var i = newStepIdx; i < titleArray.indexOf('devicePurchase'); i++) {
                  if ($scope.selectedService.selectedOptions.hasOwnProperty(titleArray[i])) {
                      delete $scope.selectedService.selectedOptions[titleArray[i]];
                  }
              }

              //update checkout basket totals if we are not on the last step, 'review' keys says we're going
              // backwards wait 1 second for the page to transition away (so '+' doesn't pop up in productPanel)

              updateTotals();
          }

          $scope.$on('animation:back', function () {
              updatePageTitleAndTotals(orderingAnimation.getCurrentPage())
          });


          //storage of selected options for final sending to server (set to null for repopulation test on language
          // change)
          $scope.selectedService = {
              selectedOptions: {}
          };
          $scope.startShowScrollbar = false;


          //===============================================================
          // MAIN logic callback from each step's directive
          //===============================================================

          //passed back by the shipping directive for address population below
          var addressList = {};

          $scope.onStepCompleted = function (data) {

              var saveOption = function (option) {
                  $scope.selectedService.selectedOptions[option.key] = option.value;
              };

              switch (data.key) {
                  case "service":   // Service catalog was finished
                      // Show animation scrollbar after first step
                      $scope.startShowScrollbar = true;
                      $scope.existingSubscription = data.existingSubscription;

                      $scope.selectedService = data.value;
                      // Prepare to add option's package ids in the next few steps
                      $scope.selectedService.selectedOptions = {};
                      // Go to the next step - warning about navigating away will now start to appear
                      confirmProgressLoss.setProgressed(true);
                      animateForwards(data);
                      break;

                  case "siteProfile": // Site profile was finished
                      // Send a request to server to save the site profile data(no of sites and users in each site)
                      // In callback, we will receive a list of product options(ex. speed, user, security...)
                      // {'speed':[{name:xxx, price:xxx},{name:xxx, price:xxx}...], 'user':[{name:xxx,
                      // price:xxx},{name:xxx, price:xxx}...], 'security':[{name:xxx, price:xxx},{}...]} 1. Insert the
                      // option keys(ex. 'user', 'speed'...) to the steps array 2. offerId now supplied with
                      // getRecommendations as not all options are supplied for some offers

                      //server needs offerId
                      data.value.offerId = $scope.selectedService.offerId;

                      // Send a request to server to save the site profile data(no of sites and users in each site)
                      //we need to make sure the optionList is populated before we start the animation,
                      //so the first option is ready
                      getRecommendations(data).then(function () {
                          animateForwards(data, true);
                          updatePageTitleAndTotals(orderingAnimation.getCurrentPage());
                      });
                      break;

                  case "devicePurchase":

                      //if the user navigates back to shipping to check devices,
                      //makes no change then goes back to shipping, we don't disturb shipping's reset on device watch
                      if (!$scope.allDevices || ($scope.allDevices && data.selectionChanged)) {
                          $scope.allDevices = convertToFlatDeviceList(data.value, data.useRecommendedDevices);
                          $scope.useRecommendedDevices = data.useRecommendedDevices;
                          // add default shipping options
                          _.map($scope.allDevices, function (device) {
                              device.installType = installOptionsFactory.getInstallType($scope.installOptions, true);
                          });
                      }

                      //skip shipping if there are no devices and make objects available to review
                      if (data.deviceCount === 0) {
                          //TODO - more elegant way to wait for css transition than timeouts below
                          //moving to review - hide all but the last step and don't trigger animation
                          transitionToEnd();
                          $scope.title = $translate.instant("ORDER." + titleArray[ titleArray.length - 1 ].toUpperCase() + ".TITLE");
                      } else {
                          // Go to the next step
                          animateForwards(data);
                      }
                      break;

                  case "shipping":
                      //make shipping address grouping available to populate review page
                      $scope.selectedService.devicesByAddress = data.value;

                      addressList = data.addressList;

                      //moving to review - hide all but the last step and don't trigger animation
                      transitionToEnd();
                      $scope.title = $translate.instant("ORDER." + titleArray[$scope.currentStepIndex + 1].toUpperCase() + ".TITLE");
                      break;

                  case "review":
                      // If the back button was clicked, go back without triggering animation
                      if (data.submitOrder == null) {

                          // Back button was clicked, so moving away from review without processing order - show
                          // previous state from animation
                          transitionFromEnd();
                          $scope.title = $translate.instant("ORDER." + titleArray[$scope.currentStepIndex].toUpperCase() + ".TITLE");
                      }
                      else {
                          //prepare final order object and get the appropriate API request
                          var apiRequest = decideApiRequest();
                          var order = buildOrderObject(apiRequest);

                          orderingBlock.start();
                          //submit prepared order object to server and change state
                          serverOrdering.submitOrder(apiRequest, order).then(
                            function success(response) {
                                orderingBlock.stop();

                                function submitOrderError(message) {
                                    confirmationModal({
                                        bodyText:   message,
                                        hideCancel: true
                                    });
                                }

                                var unknownErrorMsg = "ORDER.REVIEW.UNKNOWN_ORDER_SUBMIT_ERROR";

                                if (response.hasOwnProperty('status')) {
                                    if (!(response.status == 1 || response.status.toLowerCase() == 'ok')) {
                                        //server returned response but gives an error
                                        var message = (response.message !== undefined) ?
                                                      ((response.message !== 'failed from ncs') ? response.message : unknownErrorMsg) : unknownErrorMsg;
                                        submitOrderError(message);
                                    } else {
                                        // update serviceId in cookie and api core cache
                                        if (response.serviceId) {
                                            $cookieFactory.setServerData('serviceId', response.serviceId);
                                        } else {
                                            console.error('backend has not provided serviceId in response from create/modifyService')
                                        }
                                        //this prevents the 'state being navigated away from' prompt from appearing here
                                        confirmProgressLoss.setConfirmedLeaving(true);
                                        $state.transitionTo('root.orderConfirmation');
                                    }
                                } else {
                                    submitOrderError(unknownErrorMsg)
                                }

                            }, function error(response) {
                                orderingBlock.stop();

                                //hide global generic error message pop-down for network errors
                                $timeout(function () {
                                    $rootScope.$broadcast('global:hide');
                                });
                                var errorMsg = (response && response.message) ? response.message
                                  : "ORDER.REVIEW.UNKNOWN_ORDER_SUBMIT_ERROR";

                                confirmationModal({
                                    bodyText:   errorMsg,
                                    hideCancel: true
                                });
                            }
                          );
                      }
                      break;

                  //save selected option if
                  default:
                      if (data.option === true) {
                          saveOption(data);
                          // Go to the next step
                          animateForwards(data);
                          break;
                      } else {
                          console.error('unrecognised return from ordering step directive')
                      }

              }

          };

          //function for order submission object - keep order outside function for access by decideApiRequest
          var buildOrderObject = function (apiRequest) {
              var order = {
                  "pricing": {
                      "serviceTotal": $scope.serviceTotal,
                      "deviceTotal":  $scope.deviceTotal,
                      "installTotal": $scope.installTotal.data
                  },
                  "service": {
                      "offerId":  "",
                      "packages": []
                  },
                  "devices": []
              };
              //add offerId
              order.service.offerId = $scope.selectedService.offerId;

              //add package Ids
              for (var key in $scope.selectedService.selectedOptions) {
                  var selectedOption = $scope.selectedService.selectedOptions[key];

                  if (selectedOption.type === 'incremental') {
                      order.service.packages.push({
                          "package": selectedOption.packageId,
                          "value":   selectedOption.selectedValue
                      });
                  } else {

                      order.service.packages.push({
                          "package": selectedOption.packageId
                      });
                  }
              }
              //add current/old offerId if we are submitting request to change existing offer
              if (apiRequest === 'modifyService') {
                  order.service.oldOfferId = $scope.existingSubscription.existingSubscriptionId;
              }

              //add device type and shipping Ids (if devices have been selected)
              if ($scope.allDevices) {

                  order.devices = buildOrderFactory.buildDeviceList($scope.allDevices, addressList);
              }
              return order;
          };

          //decide whether we are creating new service
          //modifying existing service to call respective API

          //informs us which API to call - populated during serviceCatalog build
          var decideApiRequest = function () {

              if ($scope.existingSubscription.hasExistingSubscription) {
                  return 'modifyService'
              } else
              //there is no existing subscription - create a new service
              {
                  return 'createService'
              }
          };

          //================================================
          // Make a deep copy of the device object
          //================================================
          var getDeviceCopy = function (device, site, siteIndex) {

              var instanceDevice = angular.copy(device);

              //add extra information for deviceManager
              instanceDevice.status = 'default';
              instanceDevice.addressId = null;

              //add extra site-specific info from recommendedDevices, if given
              if (site) {
                  instanceDevice.siteId = siteIndex;
                  instanceDevice.siteUsers = site.users;
              } else {
                  instanceDevice.siteId = null;
                  instanceDevice.siteUsers = null;
              }

              return instanceDevice;
          };

          //================================================
          // create a flat single instance device array for address association
          //================================================
          var convertToFlatDeviceList = function (purchaseDevices, useRecommendedDevices) {
              var allPurchasedDevices = [];

              if (useRecommendedDevices && $scope.recommendedDevices.sites) {
                  //populate from untouched recommendedDevices object grouped by site

                  for (var siteIndex = 0; siteIndex < $scope.recommendedDevices.sites.length; siteIndex++) {
                      var site = $scope.recommendedDevices.sites[siteIndex];

                      for (var deviceIndex = 0; deviceIndex < (site.devices).length; deviceIndex++) {
                          var device = site.devices[deviceIndex];

                          for (var i = 0; i < Number(device.recommendedQuantity); i++) {
                              allPurchasedDevices.push(getDeviceCopy(device, site, siteIndex));
                          }
                      }
                  }
              } else {
                  //populate from user-selected devices object (in key-value object)
                  for (var deviceKey in purchaseDevices) {
                      var device = purchaseDevices[deviceKey];
                      for (var i = 0; i < Number(device.userQuantity); i++) {
                          allPurchasedDevices.push(getDeviceCopy(device));
                      }
                  }
              }
              //select first device for deviceManager class assignment
              if (allPurchasedDevices.length > 0) {
                  allPurchasedDevices[0].status = 'selected';
              }

              return allPurchasedDevices;
          };

          // default totals
          $scope.serviceTotal = 0;
          $scope.deviceTotal = 0;
          $scope.installTotal = 0;
          $scope.updateTotals = updateTotals;

          function updateTotals() {

              $scope.showBasket = {
                  all:    false,
                  device: false
              };

              //update totals up until the current view
              if (!(_.isEmpty($scope.selectedService)) && $scope.selectedService.selectedOptions != null) {
                  var serviceTotal = 0;
                  var deviceTotal = 0;
                  var installTotal = 0;
                  var installCount = 0;
                  var installPrice = 0;


                  //add the price of the service only if it represents a fixed starting price:
                  //if a service contains the mutually exclusive 'minServicePrice' then this property
                  //instead represents the total minimum cost for a service, which should then not be included
                  //as the total should instead by reached purely by adding the options.
                  //the price property is then ignored (though it is created to pass through and populate the
                  // productPanel directive)
                  if (!($scope.selectedService.hasOwnProperty('minServicePrice'))) {
                      //server may return '-1' for 'free' services
                      if ($scope.selectedService.price > 0) {
                          serviceTotal += $scope.selectedService.price;
                      }
                  }
                  // Calculate the sub-total for the service options
                  for (var key in $scope.selectedService.selectedOptions) {
                      var option = $scope.selectedService.selectedOptions[key];
                      if (option.hasOwnProperty('price') && Number(option.price) > 0) {
                          serviceTotal += Number(option.price);
                      }
                  }

                  // Calculate the sub-total for devices
                  // Make sure allDevices does exist before we calculate the subtotal of ordering devices
                  // since we only get allDevices after device purchase step
                  if ($scope.allDevices != null) {
                      for (var i = 0; i < $scope.allDevices.length; i++) {
                          var devicePrice = Number($scope.allDevices[i].price);
                          if (devicePrice > 0) {
                              deviceTotal += devicePrice;
                          }
                          //  //console.log($scope.allDevices[i].installType);
                          installPrice = installOptionsFactory.getInstallPrice($scope.installOptions, $scope.allDevices[i].installType);

                          if (installPrice > 0) {
                              installTotal += installPrice;
                              $scope.installPrice = installPrice;
                              installCount++;
                          }
                      }
                  }
              }
              $scope.installCount = installCount;
              $scope.serviceTotal = serviceTotal;
              $scope.deviceTotal = deviceTotal;
              $scope.installTotal = {data: installTotal};
              $scope.grandTotal = serviceTotal + deviceTotal + installTotal;

              //determine when to show/hide various checkout totals
              $scope.showBasket.all = $scope.isOrderingSteps
              && $scope.currentStepIndex > 0 && $scope.grandTotal > 0;

              $scope.showBasket.device = $scope.isOrderingSteps
              && $scope.currentStepIndex >= 6;

          }

          //================================
          // *ANIMATION FUNCTIONS*
          //================================


          //================================
          //TRANSITION TO AND FROM END STATE
          //=================================
          var transitionToEnd = function () {
              $scope.isOrderingSteps = false;
              updateTotals(); // to hide the basket
              $timeout(function () {
                  $scope.isReviewStep = true;
              }, 1000);
          };
          var transitionFromEnd = function () {
              $scope.isReviewStep = false;
              $timeout(function () {
                  $scope.isOrderingSteps = true;
                  updateTotals(); // to show the basket
              }, 1000);
          };
      }
  ])
;
