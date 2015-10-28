/** A controller for modal confirmation windows that have
 only 'ok' and 'cancel' buttons **/

// provide it with onOkClicked function that returns a promise on $modal.open
//
// the modal will be dismissed when the promise is resolved or rejected.
// While the promise is pending, the modal window blocks itself if
// block-ui="modalConfirmationBlock" is set to a parent element in the template
angular.module('appVPN')
  .controller('ModalConfirmationController', ['$scope', 'blockUI', '$modalInstance', 'value', 'action', function($scope, blockUI, $modalInstance, value, action) {
    var modalConfirmationBlock = blockUI.instances.get('modalConfirmationBlock');

    $scope.value = value;

    $scope.ok = function() {
      modalConfirmationBlock.start();
      action().then(function(res) {
        modalConfirmationBlock.stop();
        $modalInstance.close(res);
      })
    };

    $scope.cancel = function() {
      $modalInstance.dismiss();
    }
  }]);

