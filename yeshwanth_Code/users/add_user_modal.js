angular.module('cv.user')

  .controller('ModalInstanceCtrl', ['$scope', '$modalInstance', 'serverUsers', 'blockUI', function($scope, $modalInstance, serverUsers, blockUI) {
    // use nesting to prevent deep copying of properties
    // preventing 2-way data binding
    $scope.data = {"emailList": []};

    var userAddBlock = blockUI.instances.get('userAddBlock');

    function fail() {
      $modalInstance.close({
        success: false,
        key: "users.add_users.status_messages.error"
      });
    }

    function connectionError() {
      $modalInstance.close({
        success     : false,
        key         : "errors.network_err"
      });
    }

    function success() {
      $modalInstance.close({
        success     : true
      });
    }

    $scope.ok = function (event) {

      if($rootScope.queue.disableEdit === false) {
        userAddBlock.start();
        var usernames = $scope.data.emailList.map(function (item) {
          return item.value;
        }).filter(function (item) {
          return !!item;
        });

        serverUsers.addUsers(usernames).then(
          function(res) {
            userAddBlock.stop();
            res.status ? success() : fail();
          },
          function() {
            userAddBlock.stop();
            connectionError();
          });
      }

    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }]);
