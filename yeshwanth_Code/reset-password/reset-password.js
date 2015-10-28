'use strict';

angular.module('cv.resetPassword', ['cv.server.admin'])

  // used for both admin and user password update
  .controller('ResetPasswordController', [
    '$rootScope', '$scope', 'admin', '$location', 'serverAdmin', 'blockUI', '$window', '$state',
    function ($rootScope, $scope, admin, $location, serverAdmin, blockUI, $window, $state) {

      var resetPasswordBlock = blockUI.instances.get('resetPasswordBlock');
      // each request to reset a password gets a unique resetId which
      // proves the validity of the following request to update admin's password
      $scope.password = '';
      var params = $location.search();
      $scope.resetId = params.resetid;
      var username = params.username;
      var action = params.action ? window.atob(params.action) : '';

      $scope.username = username ? window.atob(username) : '';

      $rootScope.displayHeader = true;

      $scope.passwordRegex = admin
        ? "^.*(?=.{8,})(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).*$"
        : '^(?=.*[A-Z])(?=.*[0-9])(?=.*[a-z]).{8,}$' ;

      /*
       var myRe = new RegExp($scope.passwordRegex, "g");
       //console.log("passwordRegex:", $scope.passwordRegex);

       var pass = "Test1!23";
       var myArray = myRe.exec(pass);
       //console.log("pass:", pass, "lastIndex:", myRe.lastIndex, ", myArray:", myArray);

       var pass = "Test1!2";
       var myArray = myRe.exec(pass);
       //console.log("pass:", pass, "lastIndex:", myRe.lastIndex, ", myArray:", myArray);
       */

      $scope.title = admin
        ? 'PASSWORD_RESET.TITLE'
        : 'PASSWORD_RESET.TITLE_USER';

      $scope.weakPasswordError = admin
        ? 'shared.input.error.password.weak.admin'
        : 'shared.input.error.password.weak.user';

      function adminResetSuccessful() {
        $scope.$root.$emit('global:success', {
          key: 'password_reset.messages.success'
        });

        $window.location.href = '/login';
      }

      function userResetSuccessful() {
        $state.go('root.userResetPasswordThanks');
      }

      var successAction = admin
        ? adminResetSuccessful
        : userResetSuccessful

      var resetRequest = admin
        ? serverAdmin.adminPasswordUpdate
        : serverAdmin.userPasswordUpdate;

      function resetFailed(status, message) {
        var errorMessage;
        switch(status) {
          case 'token.invalid':
            errorMessage = 'errors.passwordreset.invalid';
            break;
          case 'token.timeout':
            errorMessage = 'errors.passwordreset.timeout';
            break;
          default:
            errorMessage = message || 'errors.passwordreset.failed';
        }
        $scope.$root.$emit('global:error', {key: errorMessage});
      }

      $scope.updatePassword = function( resetId, password) {
        resetPasswordBlock.start();
        resetRequest(resetId, password)
          .then(function (res) {
            resetPasswordBlock.stop();
            res.status ? successAction() : resetFailed(res.code, res.message);
          },
          function () {
            resetPasswordBlock.stop();
          });
      };
    }])
