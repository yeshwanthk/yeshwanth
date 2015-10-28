'use strict';

angular.module('cv.admin', ['cv.server.admin'])

.controller('AdminController', ['$rootScope', '$scope', '$cookieFactory',
function ($rootScope, $scope, $cookieFactory) {

    $scope.showPopout = true;
    $scope.popoutType = "admin";
}]);
