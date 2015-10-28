/**
 * Created by antkozlo on 12/3/14.
 */

angular.module('cv.login')
  .controller('ForgotPasswordController', ['blockUI', 'serverAdmin', '$scope', '$modalInstance', function(blockUI, serverAdmin, $scope, $modalInstance) {
    var modalBlock = blockUI.instances.get('modalBlock');

    $scope.passwordReset = function(username) {

      modalBlock.start();
      function success() {
        $modalInstance.close({
          success     : true,
          username    : username
        });
      }

      function fail() {
        $modalInstance.close({
          success     : false,
          key         : "errors.passwordReset.wrong_email"
        });
      }

      function connectionError() {
        $modalInstance.close({
          success     : false,
          key         : "errors.network_err"
        });
      }

      //console.log('Resetting password for ', username);

      serverAdmin.resetPassword(username)
        .then(function(res) {
          //console.log('Returned result');
          modalBlock.stop();
          if (!!res.status) {
            success();
          } else {
            fail();
          }
        }, function() {
          //console.log('Returned cancel');
          modalBlock.stop();
          connectionError();
        });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss();
    };
  }]);
