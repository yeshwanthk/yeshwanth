'use strict';
angular.module('appVPN')
  .controller('HeaderController', [
      'CONST',
      '$location',
      '$rootScope',
      'serverCore',
      'serverAdmin',
      'LanguageFactory',
      '$translate',
      '$scope',
      '$state',
      '$window',
      '$cookieFactory',
      'getVersion',
      'contactInfo',
      'confirmProgressLoss',
      '$timeout',
      function (CONST,
        $location,
        $rootScope,
        serverCore,
        serverAdmin,
        LanguageFactory,
        $translate,
        $scope,
        $state,
        $window,
        $cookieFactory,
        getVersion,
        contactInfo,
        confirmProgressLoss,
        $timeout) {

          $scope.LOGO_IMAGE_URL = CONST.LOGO_IMAGE_URL;
          $scope.tenantId = null;

          // setting global vars
          $rootScope.CONST = CONST;
          $rootScope.logsAPIErrors = true;

          $scope.language = {
              list:     LanguageFactory.getLanguageList(),
              selected: LanguageFactory.getMenuLanguage()
          };

          //this is only used in whiteLabel, but it allows us to keep the header.js identical
          $scope.navigationLinks = CONST.NAVIGATION_LINKS || null;

          /*          // tenantSelectionDropdown manipulation object -
           // the directive will attach selectItem function to this object
           // which should be called whenever a tenant should be selected
           // from outside the directive
           $scope.tenantDropdownProvider = {};*/

          $scope.contactInfo = contactInfo || {};

          $scope.helpDocIcon = "customization/icons/help_docs.svg";
          $scope.contactUsIcon = "customization/icons/contact_us.svg";

          $scope.goToUrl = function (url, target) {
              if (target) {
                  window.open(url, target);
              } else {
                  window.location = url;
              }
          };

          //=================================================
          // When select a language in the dropdown
          // LanguageFactory sets memory, cookie and server API
          //=================================================
          $scope.onLanguageSelected = function (data) {

              if (data) {
                  var updateServer = !$scope.stateNotLoggedIn();

                  var changeLanguage = LanguageFactory.setCurrentLanguage.bind(this, data.id, updateServer);
                  // different logic for changing language for controllers with confirm-state-change registered
                  if (confirmProgressLoss.isBlockedState()) {
                      //may need refresh or state change: ask for confirmation first
                      confirmProgressLoss.confirmProgressLoss(changeLanguage);
                  } else {
                      changeLanguage();
                  }
                  $scope.open = false;
              }
          };

          //only update the flag after a successful change (to stop premature changing before confirmation of leaving
          // ordering
          $scope.$root.$on('language:changed', function () {
              $scope.language.list = LanguageFactory.getLanguageList();
              $scope.language.selected = LanguageFactory.getMenuLanguage();
          });

          //=================================================
          // Disable/allow navigation to dashboard and update global header subtitles
          //=================================================
          // make state available for navigation logic in view
          $scope.currentState = $state.current.name;
          $scope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
              // no need to cancel requests if the state does not change
              if (fromState.name !== toState.name) {
                  serverCore.cancelRequests();
              }
          });
          $scope.$on('$stateChangeSuccess', function (event, toState) {
              $scope.currentState = toState.name;
              //console.log($scope.currentState);
          });

          //=================================================
          // Allow navigation back to the dashboard if we have a service,
          // otherwise keep the user in the Ordering section to avoid issues
          //=================================================
          $scope.navigateToDashboardEnabled = function () {
              return (!!$cookieFactory.getServerData('serviceId') && $scope.stateNotHomeOrLogin());
          };

          //=================================================
          // For generally displaying subtitle when not on dashboard
          //=================================================
          $scope.stateNotHomeOrLogin = function () {
              return (
                  $scope.currentState !== 'root.dashboard' &&
                  !$scope.stateNotLoggedIn()
              );
          };

          $scope.stateNotLoggedIn = function () {
              return (
                  $scope.currentState === 'root.admin' ||
                  $scope.currentState === 'root.login' ||
                  $scope.currentState === 'root.resetPassword' ||
                  $scope.currentState === 'root.userResetPassword' ||
                  $scope.currentState === 'root.userResetPasswordThanks'
              );
          };

          // set the page title dynamically and watch for language changes to update the text
          $scope.pageTitle = '';
          $scope.pageTitleKey = '';
          $scope.$on('app:changePageTitle', function (event, pageTitleKey) {
              $scope.pageTitleKey = pageTitleKey;
              $scope.pageTitle = $translate.instant(pageTitleKey);
          });

          $scope.$watch(function () {
              return $translate.instant($scope.pageTitleKey);
          }, function (val) {
              $scope.pageTitle = val;
          });

          //=================================================
          // Tenant functions below
          //=================================================

          $scope.selectedTenant = $rootScope.selectedTenant || null;
          $scope.tenants = $rootScope.tenants || [];

          function loadTenantsAndLanguages() {
              //console.log('Loading tenants and languages');
              // Check the cookie to see if it is admin
              // If this is admin, then reload the tenant list
              if ($rootScope.isAdmin) {
                  loadTenantList();
              }

              // Update the language drop down list
              // Does not matter the user is admin or not
              $scope.language.list = LanguageFactory.getLanguageList();
          }

          $rootScope.$on('loadTenantsAndLanguages', loadTenantsAndLanguages);

          //======================================================================
          // Callback when the user clicks any item in the selectTenant menu
          // or clicks to open the create new Tenant popover)
          //======================================================================
          $scope.onMenuItemSelected = function (data) {

              if (data.id == -1) {
                  //user has chosen to add new tenant but not pressed OK in popover yet;
                  //update name only
                  $scope.selectedTenant = {"id": data.id, "name": data.name};
                  return;
              }

              if (data.createNew) {
                  //user has created a new Tenant
                  addNewTenant(data);
              } else {
                  //user has clicked on one of the existing tenant options
                  selectTenant(data.id, true);
              }
          };

          //======================================================================
          // When the user selects add new tenant in the popout
          //======================================================================
          function addNewTenant(data) {
                  //new tenant; clear the old tenant's serviceId so we don't
                  //submit the old one ßto the server on next selectTenant request
                  //(which happens before next getAccountInfo)
              serverAdmin.createTenant(data.id)
                .then(function (response) {
                    // if no data, then old API and should just save
                    // if status is ok then proceed
                    if (!response || response.status == "ok") {
                        //TODO - the selectTenant in else branch is temporary - Joe we receive a response here (promise
                        // not rejected) but it's just {res: "your request is not found"} should this be assigned to
                        // function error by server ordering? is the message always agreed to be 'your request is not
                        // found' for non-existent APIs?
                        $cookieFactory.removeServiceId();
                        selectNewTenant(data);
                    } else {
                        selectNewTenant(data);
                        // TODO: show error
                    }
                })
                .catch(function (err) {
                    // this is ok, this mean the server does not support createTenant, it will createTenant when
                    // order is complete
                    selectNewTenant(data);
                });
          }

          function selectNewTenant(data) {
              //make sure we delete old tenant's serviceId before submitting any API calls,
              // since a new tenant does not have one
              $cookieFactory.removeServiceId();
              selectTenant(data.id, true);
          }

          //======================================================================
          // When the user selects a tenant in the tenant list drop down
          // or a page is refreshed (then we don't need to redirect user)
          //======================================================================
          function selectTenant(tenantId, shouldRedirect, dontUpdateTenant) {

              if ($scope.tenants && tenantId) {

                  // If not in tenant list add it
                  if (!_.contains(_.pluck($scope.tenants, 'id'), tenantId)) {
                      $scope.tenants.push({"id": tenantId, "name": tenantId});
                  }

                  // Save the tenant object in the cookie and payload for future server request
                  $cookieFactory.setServerData('tenantId', tenantId);

                  // Set the selected tenant - manipulates drop-down-menu from outside
                  $scope.selectedTenant = {"id": tenantId, "name": tenantId};

                  // save the selectedTenant for reversion in cancel determination of addNewTenant function
                  if ($scope.selectedTenant.id !== $scope.previousTenantId || $scope.previousTenantId == null) {
                      // (only if the function hasn't been called with -1)
                      $scope.previousTenantId = ($scope.selectedTenant.id != -1) ? $scope.selectedTenant.id : $scope.previousTenantId;

                      var redirectAfterTenantSelection = function () {
                          // TODO: remove this logic, should be moved to global, centralize all root go state logic
                          if (shouldRedirect) {
                              //TODO - find a better way to accept and revert selected tenant
                              //this avoids the confirmation bar popping up
                              //because if it's cancelled, the previousTenant is not reselected
                              confirmProgressLoss.setConfirmedLeaving(true);

                              // need to save the Tenant info outside of the header (root)!
                              $rootScope.selectedTenant = angular.copy($scope.selectedTenant);

                              $state.go($state.current.name, {}, {reload: true});
                          }
                      };

                      // if using session, aka does not need cookies
                      // then, send selectTenant to server so it can keep the tenant in the session store
                      if (!dontUpdateTenant && !$rootScope.needsCookies) {
                          serverAdmin.selectTenant($scope.selectedTenant.id)
                            .then(function success() {
                                redirectAfterTenantSelection();
                            }, function failure(response) {
                                //there was a server-side problem trying to change tenant
                                $rootScope.$emit('global:error', {key: response.message || 'ERRORS.SERVER_RESPONSE.SELECT_TENANT'});
                                //revert to the previous one? this could cause a redirect loop if server problem
                                //this is where $scope.previousTenantId would be used if still needed
                            });
                      } else {
                          redirectAfterTenantSelection();
                      }
                  }
              }
          }

          //======================================================================
          // Load the tenant from the server and put the in the drop down
          //======================================================================
          function loadTenantList() {
              // Only get tenants when admin logged in
              if ($rootScope.isAdmin) {
                  // Send the request to the server and get the latest tenant list
                  serverAdmin.getTenants().then(function (tenants) {

                      // Update the tenant list so it will show in the drop down
                      tenants.unshift({"name": 'SHARED.NAV.ADD_TENANT.TITLE', "id": "-1"});
                      $scope.tenants = tenants;

                      // Get the last selected tenant id from the cookie
                      var tenantId = $cookieFactory.getServerData('tenantId');

                      //skip the default case
                      if (tenantId && tenantId != -1) {
                          selectTenant(tenantId, undefined, true);
                      }
                      else {
                          //reset the selected tenant
                          $scope.selectedTenant = null;
                          $cookieFactory.setServerData('tenantId', null);
                      }
                  });
              }
          }

          //======================================================================
          // For any page that needs to logout
          // (ex. In login page, we always do a logout first)
          //======================================================================
          $scope.$on('logout', function (event, options) {
              $scope.logout(options);
          });

          //======================================================================
          // When the user clicks the logout button
          //======================================================================
          $scope.logout = function (options) {
              //console.log("logout options:", options);

              if (!options || !options.dontRedirect) {
                  $cookieFactory.logout();
              } else {
                  $cookieFactory.clearAll();
              }

              // Since we have remove the isAdmin cookie, set the variable to false as well
              $scope.previousTenantId = null;
          };

          $scope.cancelQueue = function() {
              $scope.cancelLabel = "Cancelling...";
              setTimeout(function() {
                  $rootScope.queue.disableEdit = false;
                  $scope.cancelLabel = "Cancel";
              }, 500);
          };

      }]);
