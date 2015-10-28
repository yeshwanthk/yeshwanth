'use strict';

angular.module('appVPN')

    //======================================================================
    // Queue up any functions that must resolve before displaying first view
    //======================================================================
  .factory('OnLoadOptions', ['$location', 'serverAccount', 'serverCore', 'LanguageFactory', '$q', '$translate', '$state', '$rootScope', '$cookieFactory', 'blockUI', 'confirmationModal', 'CONST', '$timeout', '$queueFactory',
      function ($location, serverAccount, serverCore, LanguageFactory, $q, $translate, $state, $rootScope, $cookieFactory, blockUI, confirmationModal, CONST, $timeout, $queueFactory) {
          return function () {
              //console.log('getAccountInfo resolve started');
              var currentPage = $rootScope.targetState;
              var deferred = $q.defer();

              function onError(error, state, forceState) {
                //console.log('OnLoadOptions error', error, ", state:", state, 'path:', $location.path());

                if( (($location.path() !== '/login') &&
                     ($location.path() !== '/adminLogout')) ||
                     forceState) {
                    //console.log("getAccountInfo Error:", error);

                    if(error == 'api_reject') {
                        // stop all blockUI instances
                        _.invoke(blockUI.instances, 'stop');

                        // pop a window that notifies user
                        // that he will be logged out
                        confirmationModal({
                          headerText: 'ERRORS.SESSION_EXPIRED.HEADER',
                          bodyText:   $translate.instant('ERRORS.SESSION_EXPIRED.BODY', {'minutes': CONST.SESSION_TIMEOUT_MIN || 15}),
                          hideCancel: true
                        }).finally(function () {
                          $cookieFactory.logout();
                        });

                        // in the case the user navigates to "/" and they are not logged in
                        // the default route is root.services
                        // if this is the case route them to empty
                        if($location.path() == '/services') {
                          $state.go('root.empty');
                          deferred.resolve();
                        } else {
                           deferred.reject();
                        }
                    }
                    else {
                        if(state) {
                            $state.go(state);
                            deferred.reject();
                        } else {
                            $state.go('root.empty');
                            $cookieFactory.logout();
                            deferred.reject();
                        }
                    }
                } else {
                    if($location.path() === '/login') {
                      $rootScope.displayHeader = true;
                    }

                    // login, this error is ok
                    deferred.resolve();
                }
              }

              //console.log('getAccountInfo not cached; fetching from server');
              // data not found in cookie, get it from server via API
              //what we want to do with the getAccountInfo promise only if there are no cookies
              serverAccount.info()
                .then(function (info) {

                    //console.log('getAccountInfo info:', info);
                    $rootScope.displayHeader = false;

                    // not all server versions return with status
                    // need to check if the args are set or not
                    if (info &&
                      info.providerId &&
                      info.userId) {

                        $rootScope.displayHeader = true;

                        $cookieFactory.removeServiceId();
                        var serviceId = info.serviceId;
                        if (_.isArray(serviceId)) {
                            serviceId = serviceId[0];
                        }

                        if (!$rootScope.needsCookies) {
                            $cookieFactory.clearAll();
                        }

                        //server currently returning string instead of boolean;
                        //this corrects in either case to display the Admin options
                        info.isAdmin = !!info.isAdmin;

                        $cookieFactory.isAdmin(info.isAdmin || $cookieFactory.isAdmin());

                        $cookieFactory.setServerData('providerId', info.providerId);
                        // if the user has not logged in - return him back to login page.
                        if (!info.userId &&
                          (currentPage !== 'root.login') &&
                          (currentPage !== 'root.resetPassword') &&
                          (currentPage !== 'root.userResetPassword') &&
                          (currentPage !== 'root.userResetPasswordThanks')) {
                            onError('No userId');
                            return;
                        }
                        $cookieFactory.setServerData('userId', info.userId);

                        $cookieFactory.setServerData('tenantId',
                          ($rootScope.selectedTenant ? $rootScope.selectedTenant.id : null)
                          || $cookieFactory.getServerData('tenantId')
                          || info.tenantId
                          || null);

                        //needs timeout to prevent helptext balloon appearing and not disappearing again
                        //needs tenantId set first (above) for loadTenantsAndLanguages to be correct
                        if ($cookieFactory.isAdmin()) {
                            $timeout(function () {
                                $rootScope.selectedTenant = {id: $cookieFactory.getServerData('tenantId') };
                                $rootScope.$broadcast('loadTenantsAndLanguages');
                            }, 300);
                        }

                        // If no tenant selected return to 'admin' page
                        // to enforce tenant selection
                        if (
                          !!$cookieFactory.isAdmin() && !($cookieFactory.getServerData('tenantId'))
                          && currentPage !== 'root.admin') {
                            onError('is Admin and no tenant id!', 'root.admin', true);
                            return;
                        }

                        //start the queue if necessary
                        //shouldn't block the rest from resolving if acking fails
                        $queueFactory.clearStatus().then(function (res) {
                            if (res &&
                                res.apiId &&
                                res.qStatus &&
                                res.qStatus === "pending") {
                                $queueFactory.start(res.apiId);
                            }
                        });

                        // if tenant is selected but no order has been placed (no serviceId) -
                        // return to ordering page to complete the order
                        if (!!$cookieFactory.getServerData('tenantId') && !serviceId &&
                          (currentPage !== 'root.ordering')) {
                            onError('No service id', 'root.ordering', true);
                            return;
                        }

                        if (
                          !!$cookieFactory.getServerData('tenantId') && !!serviceId &&
                          ((currentPage === 'root.admin') || (currentPage === 'root.login')) && !(currentPage === 'root.services')
                        ) {
                            onError(null, CONST.HOME_STATE, true);
                            return;
                        }

                        // Save everything we get from the server to cookies
                        $cookieFactory.setServerData('serviceId', serviceId);

                        // Save the available languages to cookie
                        $cookieFactory.saveLanguages(info.supportLang);

                        //only now the cookiestore is ready for us to build the language list
                        LanguageFactory.buildLanguageList();

                        // Update the current selected language but don't update the server
                        // since we just get it from the server response
                        LanguageFactory.setCurrentLanguage(info.lang || null, false).then(function () {
                            deferred.resolve();
                        });

                    } else {

                        onError('var check');

                        if(info) {

                          // Save everything we get from the server to cookies
                          $cookieFactory.setServerData('serviceId', serviceId);

                          // Save the available languages to cookie
                          $cookieFactory.saveLanguages(info.supportLang);

                          //only now the cookiestore is ready for us to build the language list
                          LanguageFactory.buildLanguageList();

                          // Update the current selected language but don't update the server
                          // since we just get it from the server response
                          LanguageFactory.setCurrentLanguage(info.lang || null, false).then(
                            function () {
                                deferred.resolve();
                          });
                        }
                    }
                }, function () {
                    onError('api_reject');
                });

              return deferred.promise;
          };
      }])

    //=======================================================================
    // Various utility directives used in View throughout the app
    //=======================================================================

  .filter('toSentenceCase', function () {
      return function (input) {
          if (input != null)
              input = input.toLowerCase();
          return input.substring(0, 1).toUpperCase() + input.substring(1);
      }
  })

  .filter('keylength', function () {
      return function (input) {
          if (!angular.isObject(input)) {
              throw Error("Usage of non-objects with keylength filter!");
          }
          return Object.keys(input).length;
      }
  })

  .directive('numbersOnly', function () {
      return {
          restrict: 'A',
          require:  '?ngModel',
          link:     function ($scope, $element, $attributes, ngModel) {

              if (!ngModel) {
                  console.error('numbers-only directive requires an ng-model');
                  return;
              }

              $element.bind('keydown', function (event) {
                  if (event.keyCode === 8 && ($element.val().length == 1 || $element.val() === "")) {
                      ngModel.$setViewValue('0');
                      ngModel.$render();
                      event.preventDefault();
                  }
              });

              function isNotControlKey(event) {
                  return event.charCode !== 0 && event.keyCode !== 8 && event.keyCode !== 9 && event.keyCode !== 46 && event.keyCode !== 38 && event.keyCode !== 40
              }


              //this will only work for elements set with the 'tel' field
              // which disables angular's form validation, so decide if you want this check
              function isNotTextSelected(element) {

                  if (element[0].type === 'number') {
                      return true
                  }
                  return element[0].selectionStart === element[0].selectionEnd;
              }


              //prevent press of non-(positive)-numbers
              $element.bind('keypress', function (event) {

                  var inputChar = String.fromCharCode(event.charCode);

                  var numberRegExp = new RegExp('[0-9]');
                  if (!numberRegExp.test(inputChar) && isNotControlKey(event)) {
                      event.preventDefault();
                      return
                  }

                  //eliminate leading zeroes before determining character limit
                  if ($element.val().substr(0, 1) === '0') {
                      ngModel.$setViewValue($element.val().substr(1) + inputChar);
                      ngModel.$render();
                      event.preventDefault();
                  }
                  var limit = $attributes.charLimit;
                  //input was OK (number), but we have reached limit

                  if (limit) {
                      limit = Number(limit);
                      if ($element.val().length >= limit && isNotTextSelected($element)) {
                          event.preventDefault();
                      }
                  }
              });
          }
      };
  })
  .directive('ngPluralize', function () {
      return {
          restrict:   'EA',
          priority:   1,
          transclude: 'element',
          link:       function (scope, element, attrs, ctrl, transclude) {
              scope.$watch(attrs.when, function (when) {
                  if (when) {
                      transclude(function (clone) {
                          element.replaceWith(clone);
                          element = clone;
                      });
                  }
              });
          }
      };
  });

