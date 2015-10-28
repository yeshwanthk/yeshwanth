'use strict';

angular.module('cv.login', ['cv.server.admin', 'blockUI'])

  .controller('LoginController', ['$rootScope', '$scope', 'serverAdmin', '$state', '$window', 'blockUI', '$modal', 'serverCore', '$cookieFactory', 'LanguageFactory', 'confirmProgressLoss',
    function ($rootScope, $scope, serverAdmin, $state, $window, blockUI, $modal, serverCore, $cookieFactory, LanguageFactory, confirmProgressLoss) {

        //the #popover-language-selector nsPopover that this populates
        // is shared by the header and found in global.header.html
        $scope.language = {
            list:     LanguageFactory.getLanguageList(),
            selected: LanguageFactory.getMenuLanguage()
        };

          //=================================================
          // When select a language in the dropdown
          // LanguageFactory sets memory, cookie and server API
          //=================================================
          $scope.onLanguageSelected = function (data) {
            if (data) {
              var updateServer = false;
              var changeLanguage = LanguageFactory.setCurrentLanguage.bind(this, data.id, updateServer);
              changeLanguage();
              $scope.open = false;
            }
          };

          //only update the flag after a successful change (to stop premature changing before confirmation of leaving
          // ordering
          $scope.$root.$on('language:changed', function () {
            $scope.language.selected = LanguageFactory.getMenuLanguage();
          });

          //======================================================================
          // Open the modal dialog to ask the user for email address
          //======================================================================
          $scope.openModal = function () {
              // Open the forget password modal dialog
              var forgotPasswordModal = $modal.open({
                  templateUrl: 'views/login/forgot-password.html',
                  controller:  'ForgotPasswordController',
                  windowClass: 'medium'
              });

              // Callback when the modal is closed
              forgotPasswordModal.result.then(function (result) {
                  if (result.success) {
                      //console.log('Emitting success');
                      $scope.$root.$emit('global:success', {
                          key:         'login.status_messages.success',
                          interpolate: {'username': result.username}
                      });
                  } else {
                      //console.log('Emitting error');
                      $scope.$root.$emit('global:error', {key: result.key || "errors.unknown"});
                  }
              })
          };

          //======================================================================
          // When the user clicks on the login button
          //======================================================================
          $scope.login = function (username, password, form) {
              // force form validation because the login button
              // is enabled ob the page load - this is a
              // workaround over Chrome's form autofill issue
              // when the value of a saved field is not applied to the form until
              // any user input happens on the page.
              form.password.$setDirty();
              form.username.$setDirty();

              // do not continue the form submission if it's invalid
              if (form.$invalid) {
                  return;
              }

              //----------------------------------------------------------------------
              // Save the login related data to cookie and payload and then redirect
              //----------------------------------------------------------------------
              function showLoginFailure(err) {
                  //console.log('Login failed error:', err);
                  $scope.$root.$emit('global:error', {key: "errors.login." + ((err ? err.error : '') || "general")});
              }

              //----------------------------------------------------------------------
              // Login function's init
              //----------------------------------------------------------------------
              // 1. Make sure we do have user name and the password
              if (!(username && password)) {
                  //console.log('Username and password are required!');
                  // TODO: Probably need to show the global alert when missing the id&password
                  //showLoginFailure("Need name & password")
                  return;
              }

              // 2. Show the blocking overlay
              loginBlock.start();

              // 3. Send the login request to the server
              serverAdmin.login(username, password).then(
                function (res) {
                    $scope.$root.$emit('global:hide');
                    // If the response is successful(=1), and we are able to save all
                    // related data to memory+cookie

                    if (res.status == 1) {
                      // Remove the loader
                      loginBlock.stop();

                      $cookieFactory.adminLogin(res.superuser_profile);

                      // Success. Switch to the admin page
                      $state.go('root.admin', {reload: true});
                    } else {
                        // No, show error notification
                        showLoginFailure(res.error);
                        // Remove the loader
                        loginBlock.stop();
                    }
                }, function (error) {
                    // Remove the loader
                    loginBlock.stop();
                    // Show the error notification
                    showLoginFailure(error);
                }
              );
          };

          //======================================================================
          // Controller's Init
          //======================================================================

          // Get the blocker/loader that will be used when the login button is clicked
          var loginBlock = blockUI.instances.get('loginBlock');
      }]);
