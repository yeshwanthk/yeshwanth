'use strict';

angular.module('cv.user', ['cv.server.users', 'mm.foundation.modal', 'cv.multiInput', 'cv.components.slider', 'cv.components.search'])

  .controller('UserController', ['$rootScope', '$scope', 'serverUsers', '$modal', '$filter', 'cvCountdown', function ($rootScope, $scope, $serverUsers, $modal, $filter, $cvCountdown) {

      $rootScope.$broadcast('app:changePageTitle', 'DASHBOARD.HEADER_USERS');

      var countDownLength = 5;

      /** Controlling countdown for user state change **/
      $scope.countdown = $cvCountdown;

      /** Sorting users **/
      $scope.setSortOrder = function(sortBy) {

        if (sortBy == $scope.sortBy) {
          $scope.sortReverse = !$scope.sortReverse;
        } else {
          if (sortBy == 'status,activity,username') {
            $scope.sortReverse = true;
          } else {
            $scope.sortReverse = false;
          }
          $scope.sortBy = sortBy;
        }

      };
      $scope.setSortOrder('username');

    /** Contolling state of several selected users **/
      $scope.selectedUsers = [];
      $scope.selectedUsersActivity = 0;

      /** Searching users **/

          // the structure of this object should correspond
          // the structure of the objects on which
          // search is performed in order for ng-filter to
          // work properly
      $scope.search = {'username': ''};


      /** Processing error request states **/
      function networkError() {
          $scope.$root.$emit('global:error', {key: "errors.network_err"});
      }

      function requestFailed(error, interpolate) {
          $scope.$root.$emit('global:error', {key: error, interpolate: interpolate});
      }

      function requestSucceeded(message, interpolate) {
          $scope.$root.$emit('global:success', {key: message, interpolate: interpolate});
      }

      function updateUsers() {
          $serverUsers.getUsers()
            .then(function (response) {
                // Convert object from backend format to the one useful here
                $scope.selectedUsers = [];
                $scope.users = response;
            })
      }

      // triggered after a user gets selected, with selected user
      // in a parameter.
      $scope.onSelectionChange = function (user) {

          var newState = !user.selected;
          user.selected = newState;

          if(newState) {
              $scope.selectedUsers.push(user);
          } else {
              $scope.selectedUsers.splice(
                  $scope.selectedUsers.indexOf(user), 1
              );
          }

          $scope.selectedUsersActivity = getUsersActivity($scope.selectedUsers);
      };

      $scope.onSearchTextChange = function () {
          $scope.countdown.apply();
            $scope.selectedUsers = [];

          $scope.users.forEach(function (user) {
              user.selected = false;
          });
      };

      $scope.onSelectAll = function () {
          var newState = !$scope.allSelected();

          // select only fitered users
          var filtered_users = $filter('filter')($scope.users, $scope.search);

          filtered_users.forEach(function (user) {
              user.selected = newState;
          });

          $scope.selectedUsers = newState ? filtered_users : [];
          $scope.selectedUsersActivity = getUsersActivity($scope.selectedUsers);
      };

      $scope.allSelected = function () {
          if (!$scope.users) {
              return false;
          }
          // check only filtered users
          var filtered_users = $filter('filter')($scope.users, $scope.search);

          if (filtered_users.length == 0) {
              return false;
          }

          return ($scope.selectedUsers.length == filtered_users.length);
      };

      /** 'Add users' modal window **/
      $scope.openAddUserModal = function () {

        if($rootScope.queue.disableEdit === false) {

          var modalInstance = $modal.open({
              templateUrl: 'views/users/add_user_modal.html',
              controller: 'ModalInstanceCtrl',
              windowClass: 'medium'
          });

          // retrieve users from modal window
          modalInstance.result.then(function (result) {
              if (result.success) {
                  $scope.$root.$emit('global:success', {
                      key: 'users.add_users.status_messages.success'
                  });

                  // get users from server again
                  updateUsers();
              } else {
                  $scope.$root.$emit('global:error', {key: result.key || "errors.unknown"});
              }

          });


        }
      };

      $scope.openResetPasswordsModal = function () {
          var usernames = $scope.selectedUsers.map(function (user) {
              return user.username;
          });
          var modalInstance = $modal.open({
              templateUrl: 'views/users/reset-passwords-modal.html',
              controller: 'ModalConfirmationController',
              windowClass: 'medium',
              resolve: {
                  value: function () {
                      return usernames;
                  },
                  action: function () {
                      return $serverUsers.resetPasswords.bind(null, usernames);
                  }
              }
          });
          // returned when request is complete
          modalInstance.result.then(function (res) {
              if (res.status) {
                  requestSucceeded('users.reset_passwords.status_messages.success');
              } else {
                  requestFailed('users.reset_passwords.status_messages.error');
              }
          });
      };

      $scope.openDeleteUsersModal = function () {

        if($rootScope.queue.disableEdit === false) {

          var usernames = $scope.selectedUsers.map(function (user) {
              return user.username;
          });
          var modalInstance = $modal.open({
              templateUrl: 'views/users/delete-users-modal.html',
              controller: 'ModalConfirmationController',
              windowClass: 'medium',
              resolve: {
                  value: function () {
                      return usernames;
                  },
                  action: function () {
                      return $serverUsers.deleteUsers.bind(null, usernames);
                  }
              }
          });
          // returned when request is complete
          modalInstance.result.then(function (res) {
              if (res.status) {
                  $scope.selectedUsers = [];
                  updateUsers();
                  requestSucceeded('users.delete_users.status_messages.success');
              } else {
                  requestFailed('users.delete_users.status_messages.success');
              }
          });
        }

      };


      /** 3-state user slider **/


      /**
       * Get Users' common status:
       * 0 - all inactive
       * 1 - some active, some inactive
       * 2 - all active
       */
      function getUsersActivity(users) {
          if (users.every(function (user) {
                return !user.activity;
            }))
              return 0;
          else if (users.every(function (user) {
                return user.activity;
            }))
              return 1;
          else return 0.5;
      }

      function setUsersStatus(users, active) {

          function onTimerDismissed() {
              $scope.selectedUsersActivity = getUsersActivity($scope.selectedUsers);
          }

          function onTimerTick() {
          }

          // set selectedUsersActivity prior to an actual change to be able th catch an undo action
          $scope.selectedUsersActivity = active;

          // count number of users gets affected by the change
          // introduced by slider movement
          $scope.nUsersAffected = $scope.selectedUsers.filter(function (user) {
              return user.active != active;
          }).length;

          var usernames = users.map(function (user) {
              return user.username;
          });

          $scope.countdown.start(countDownLength)
            .then(function () {
                $serverUsers.updateUsersActivationStatus(usernames, active)
                  .then(function (res) {
                      // pass userIds, not users themselves,
                      // because users array might be modified
                      // while request to backend is in progress
                      res.status ? updateUsers() : requestFailed()
                  })
            }, onTimerDismissed, onTimerTick);
      }

      // applies change that's pending on timer
      $scope.applyChange = function () {
          if($scope.countdown.ticking && $rootScope.queue.disableEdit === false) {
              $scope.countdown.apply();
          }
      };

      $scope.resetPasswords = function (users) {
          var usernames = _.map(users, function (user) {
              return user.username
          });

          function passwordsReset(usernames) {
              //console.log('Passwords reset for users', usernames, '. what next?');
          }

          $serverUsers.resetPasswords(usernames)
            .then(function (res) {
                res.status ? passwordsReset(usernames) : requestFailed();
            }, networkError);
      };

      $scope.onSlider = function (data) {
          for (var i = 0; i < data.length; i++) {
              data[i] = Number(data[i]);
          }
          // re-calculate users status, because slider updates it automatically to
          // it's new position
          if (data.value == getUsersActivity($scope.selectedUsers)) {
              $scope.countdown.dismiss();
              return;
          }
          switch (data.value) {
              case 0:
                  setUsersStatus(
                    $scope.selectedUsers,
                    0
                  );
                  break;
              case 1:
                  setUsersStatus(
                    $scope.selectedUsers,
                    1
                  );
                  break;
              default:
                  break;
          }
      };
      updateUsers();

  }])
;
