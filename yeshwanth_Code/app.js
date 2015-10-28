'use strict';

/**
 * @ngdoc overview
 * @name appVPN
 * @description
 * # appVPN
 *
 * Main module of the application.*/


angular.module('appVPN', [
    'mm.foundation',
    'nvd3',
    'nvd3ChartDirectives',
    'ngAnimate',
    'ngSanitize',
    'pascalprecht.translate',
    'ui.router',
    'ui.utils',
    'nsPopover',
    'blockUI',
    'dndLists',
    'angularMapbox',
    'cv.language',
    'cv.confirmationModal',
    'cv.confirmProgressLoss',
    'cv.server',
    'cv.devices',
    'cv.services',
    'cv.countdown',
    'cv.ordering.main',
    'cv.ordering.orderDevice',
    'cv.logs',
    'cv.login',
    'cv.admin',
    'cv.resetPassword',
    'cv.user',
    'cv.input',
    'cv.ionSlider',
    'cv.setInvalid',
    'cv.inputMatch',
    'cv.multiInput',
    'cv.datePicker',
    'cv.map',
    'cv.splitPanel',
    'cv.spinner',
    'cv.autoLockTop',
    'cv.infiniteScroll',
    'cv.svgImport',
    'cv.scrollToView',
    'cv.server.admin',
    'cv.server.core',
    'cv.server.queue',
    'cv.deviceDetailsPanel',
    'cv.alertPopup',
    'cv.slidingPanels',
    'cv.dropDownMenu',
    'ipCookie'])

  .config(['blockUIConfig',
      function (blockUIConfig) {
          blockUIConfig.message = 'Please stop clicking!';
          blockUIConfig.delay = 100;
          // Disable automatically blocking of the user interface
          //blockUIConfig.autoBlock = false;
          // Disable auto body block
          blockUIConfig.autoInjectBodyBlock = false;
          blockUIConfig.templateUrl = '/views/block-ui-template.html';
      }])

  .config(['$translateProvider',
      function languageConfig($translateProvider) {

          /* Don't use .determinePreferredLanguage(),
           * if a string is returned that angular-translate
           * can't interpret, it will set the translateCookie
           * as undefined which causes app exceptions.
           * */
          $translateProvider.useStaticFilesLoader({
              prefix: 'customization/i18n/locale-',
              suffix: '.json'
          })

              //change here for each country installed to (prevent keys from showing in the worst case)
            .preferredLanguage('en_US')

            .useLoaderCache(true);

      }])
  .config(['$stateProvider', '$locationProvider', '$urlRouterProvider', 'CONST', function ($stateProvider, $locationProvider, $urlRouterProvider, CONST) {
      $locationProvider
        .html5Mode({enabled: true, requireBase: false})
        .hashPrefix('!');

      //$compileProvider.debugInfoEnabled();
      // angular.reloadWithDebugInfo();

      // Every time when the user changes the URL or any redirect that triggers this
      // This will be processed to decide whether or not we allow the url to be loaded
      // If return false, then it will proceed $stateProvider's resolve function in the next section
      $urlRouterProvider.when(/.*/, ['$match', '$state', '$location', 'serverCore', 'serverAdmin', '$timeout', '$cookieFactory', 'serverAccount',
          function ($match, $state, $location, $serverCore, $serverAdmin, $timeout, $cookieFactory, serverAccount) {

              // is the user got redirected using SSO, he gets to this route first
              if ($match[0] === '/sso') {
                  // the server pushes the cookie with profile object to the client.
                  // the processing of this cookie by the browser may take time,
                  // so process the cookie after a timeout, then - redirect to
                  // the page determined by further redirect logic

                  // need to get the version first so the saveLoginCookie can know if version 1/2 api
                  serverAccount.getVersion().then(function () {
                      // Break down the server pushed "profile" object into individual cookies(ex. tenantId, userId,...)
                      $cookieFactory.saveLoginCookie(null);
                      // Redirect to the root so it will use the redirect logic below to determine where the page
                      // should be loaded
                      $location.path('/');
                  });
                  return true;
              }

              return false;
          }]);

      $stateProvider
        .state('root', {
            url:        '',
            abstract:   true,
            controller: 'HeaderController',
            resolve:    {
                // TODO: replace CONST with this
                //appSettings: function (serverAccount) {
                //  return serverAccount.getAppSettings();
                //},
                contactInfo: function (serverAccount) {
                    return serverAccount.getContactInfo();
                },
                getVersion:  function (serverAccount) {
                    return serverAccount.getVersion();
                }
            },
            views:      {
                '':            {
                    templateUrl: 'views/main.html'
                },
                'header@root': {
                    templateUrl: 'views/shared/global.header.html',
                    controller:  'HeaderController'
                }
            }
        })
        .state('root.devices', {
            url:     '/devices',
            resolve: {
                supportedDeviceTypes: ['OnLoadOptions', 'serverDevices', function (OnLoadOptions, serverDevices) {
                    return OnLoadOptions()
                      .then(function () {
                          return serverDevices.getSupportedDeviceTypes();
                      });
                }]

            },
            views:   {
                'body@root':                              {
                    controller:  'DevicesController',
                    templateUrl: 'views/devices/devices.html'
                },
                'body@root.devices':                      {
                    templateUrl: 'views/devices/body.html'
                },
                // ----------------------
                'sidebar-unused@root.devices':            {
                    templateUrl: 'views/devices/sidebar-unused.html'
                },
                'sidebar-registered@root.devices':        {
                    templateUrl: 'views/devices/sidebar-registered.html'
                },
                'sidebar-needs-edit@root.devices':        {
                    templateUrl: 'views/devices/sidebar-needs-edit.html'
                },
                'sidebar-new-device-adding@root.devices': {
                    templateUrl: 'views/devices/sidebar-new-device-adding.html'
                },
                'sidebar-new-device-setup@root.devices':  {
                    templateUrl: 'views/devices/sidebar-new-device-setup.html'
                },
                // ----------------------
                'sidebar-details@root.devices':           {
                    templateUrl: 'views/devices/sidebar-details.html'
                }
            }
        })
        .state('root.login', {
            url:     '/login',
            views:   {
                'body@root': {
                    controller:  'LoginController',
                    templateUrl: 'views/login/login.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.resetPassword', {
            url:   '/password-reset',
            views: {
                'body@root': {
                    controller:  'ResetPasswordController',
                    templateUrl: 'views/reset-password/reset-password.html',
                    resolve:     {
                        admin: function () {
                            return true;
                        }
                    }
                }
            }
        })
        .state('root.userResetPassword', {
            url:   '/user-password-reset',
            views: {
                'body@root': {
                    controller:  'ResetPasswordController',
                    templateUrl: 'views/reset-password/reset-password.html',
                    resolve:     {
                        admin: function () {
                            return false;
                        }
                    }
                }
            }
        })
        .state('root.userResetPasswordThanks', {
            url:   '/user-password-reset-complete',
            views: {
                'body@root': {
                    controller:  'ResetPasswordController',
                    templateUrl: 'views/reset-password/reset-password-thanks.html',
                    resolve:     {
                        admin: function () {
                            return false;
                        }
                    }
                }
            }
        })
        .state('root.logs', {
            url:     '/logs',
            views:   {
                'body@root': {
                    controller:  'LogsController',
                    templateUrl: 'views/logs/logs.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.welcome', {
            url:   '/welcome',
            views: {
                'body@root': {
                    templateUrl: 'views/ordering/steps/welcome/ordering.welcome.html'
                }
            }
        })
        .state('root.ordering', {
            url:     '/ordering',
            views:   {
                'body@root': {
                    controller:  'OrderingMainController',
                    templateUrl: 'views/ordering/ordering.main.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.orderDevice', {
            url:     '/orderDevice',
            views:   {
                'body@root': {
                    controller:  'OrderDeviceController',
                    templateUrl: 'views/ordering/orderDevice/orderDevice.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.orderConfirmation', {
            url:     '/orderConfirmation',
            views:   {
                'body@root': {
                    templateUrl: 'views/ordering/steps/confirmation/ordering.confirmation.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.services', {
            url:   '/services',
            views: {
                'body@root':               {
                    controller:  'ServicesController',
                    templateUrl: 'views/services/services.html',
                    resolve:     {
                        supportedDeviceTypes: ['OnLoadOptions', 'serverDevices', function (OnLoadOptions, serverDevices) {
                            return OnLoadOptions()
                              .then(function () {
                                  return serverDevices.getSupportedDeviceTypes();
                              });
                        }]
                    }
                },
                'mainpanel@root.services': {
                    controller:  'ServicesMapController',
                    templateUrl: 'views/services/mainpanel.html'
                }
            }
        })
        .state('root.services.site', {
            url:     '/:id',
            views:   {
                'detailspanel@root.services': {
                    controller:  'ServicesSiteDetailsController',
                    templateUrl: 'views/services/sitedetailspanel.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.users', {
            url:     '/users',
            views:   {
                'body@root': {
                    controller:  'UserController',
                    templateUrl: 'views/users/users.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        })
        .state('root.empty', {
            url:   '/-',
            views: {
                'body@root': {
                    templateUrl: 'views/admin/empty.html'
                }
            }
        })
        .state('root.admin', {
            url:   '/admin',
            views: {
                // 'header@root': {
                //     templateUrl: 'views/shared/global.header.html',
                //     controller: 'HeaderController'
                // },
                'body@root': {
                    controller:  'AdminController',
                    templateUrl: 'views/admin/empty.html'
                }
            },
            resolve: {
                loadOptions: function (OnLoadOptions) {
                    return OnLoadOptions();
                }
            }
        });

      $urlRouterProvider.otherwise(CONST.HOME_PATH);

  }])
  .run(['$rootScope', '$state', '$timeout', 'adjustWindowHeightFactory', '$translate', 'CONST', function ($rootScope, $state, $timeout, adjustWindowHeightFactory, $translate, CONST) {

      //make sure that existing global error messages don't persist through state changes
      $rootScope.$on('$stateChangeStart', function (e, toState) {
          $rootScope.$broadcast('global:hide', true);
          $rootScope.targetState = toState.name;
      });
      $rootScope._ = _;
      $rootScope.$on('language:changed', function () {
          $rootScope.appTitle = $translate.instant('TITLE');
      });

      angular.element(document).ready(function () {

          $timeout(function () {
              adjustWindowHeightFactory();
          }, 100)
      });

      angular.element(window).on('resize', function () {
          adjustWindowHeightFactory();
      });

      $rootScope.queue = {
          disableEdit: false,
          items: []
      };

  }])

  .factory('adjustWindowHeightFactory', [function () {
      return function (headerContainer, resizeContainer) {
          var header = headerContainer ? headerContainer : $("#header-container");
          var content_height = $("#root-container").height() - header.height();
          var main_container = $("#main-container");
          main_container.height(content_height);
          if (resizeContainer) {
              resizeContainer.height(content_height);
          }
      };
  }]);
