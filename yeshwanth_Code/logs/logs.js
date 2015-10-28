'use strict';

angular.module('cv.logs', ['cv.server.logs', 'cv.components.slider', 'cv.components.search', 'cv.datePicker', 'cv.infiniteScroll'])

  .controller('LogsController', ['$rootScope', '$scope', 'serverLogs', 'cvCountdown', function ($rootScope, $scope, $serverLogs, $cvCountdown) {

    $rootScope.$broadcast('app:changePageTitle', 'DEVICES.LOGS.HEADER');

    $scope.filterList = [
      {value: 0, name: 'LOGS.FILTERS.ALL'},
      {value: 3, name: 'LOGS.FILTERS.CRITICAL'},
      {value: 2, name: 'LOGS.FILTERS.WARNING'},
      {value: 1, name: 'LOGS.FILTERS.INFO'}
    ];

    $scope.searchIntervalList = [
      {value: "all",   name: 'LOGS.TIME.ALL'},
      {value: "range", name: 'LOGS.TIME.RANGE'}
    ];

    $scope.selectFilter = function(value){
      $scope.filterSeverity = value;
      $scope.updateLogs();
    };

    $scope.selectSearchInterval = function(value){
      $scope.searchInterval = value;
      $scope.updateLogs();

      if($scope.searchInterval == 'range'){
        $scope.disableCustomRange = false;
      } else {
        $scope.disableCustomRange = true;
      }
    };

    $scope.disableCustomRange = true;

    var table = undefined;
    function adjustLogsTableWidth() {
      var windowHeight = $(window).height();
      var tableOffsetTop = table.offset().top;

      var tableHeightShouldBe = windowHeight - tableOffsetTop;

      table.css('max-height', tableHeightShouldBe);
    }

    $(document).ready(function() {table = $('.logs-table-contents')});

    setTimeout(adjustLogsTableWidth, 300);
    $(window).resize(adjustLogsTableWidth);

    // shows first date picker programmatically
    $scope.showDatePicker1 = false;

    $scope.serverLogs = $serverLogs;
    $scope.searchInterval = 'all';
    $scope.filterSeverity = 0;

    //severity -> severity,
    // timestamp -> time,
    // description -> desctiption
    $scope.sortBy = 'time';
    $scope.sortReverse = true;

    // show button only if search text changes
    $scope.searchTextChanged = false;

    $scope.logs = [];

    $scope.busy = false;

    // true when there are no more logs coming from backend
    // conforming to given criteria when logs are scrolled down
    var noMoreResults = false;

    // parameters for log filtering on backend
    var logsRange = {
      start: 0,
      count: 50
    };

    var selectedDate = {start: undefined, end: undefined};

    $scope.showDateRangeError = false;

    $scope.countdown = $cvCountdown;

    // the structure of this object should correspond
    // the structure of the objects on which
    // search is performed in order for ng-filter to
    // work properly
    $scope.search = {'description': ''};

    $scope.searchUpdated = function (searchContents) {
      $scope.logs = [];
      $scope.busy = true;
      function countdownDismissed() {
      }
      function countdownTick(timeLeft) {
      }
      $scope.search.description = searchContents;
      if(searchContents.length > 0) {
        $scope.countdown.start(1)
          .then(
          $scope.updateLogs,
          countdownDismissed,
          countdownTick)
      } else {
        $scope.countdown.dismiss();
        $scope.updateLogs();
      }
    };

    $scope.onScroll = function () {
      if(noMoreResults) {
        return
      }
      logsRange.start += logsRange.count;

      $scope.updateLogs(true);
      // need to re-render because onScroll is called from infinite-scroll
      $scope.$apply();
    };

    $scope.updateLogs = function (preserveCount) {
      var parameters = {};
        $scope.showDateRangeError = false;
      if ($scope.searchInterval == 'range') {
        $scope.showDatePicker1 = true;
        if (isCorrectDateRange(selectedDate.start, selectedDate.end)) {
          parameters.timeStart = moment(selectedDate.start).format(moment.ISO_8601());
          parameters.timeEnd = moment(selectedDate.end).format(moment.ISO_8601());
          $scope.showDateRangeError = false;
        }
        else {
          if (typeof(selectedDate.start) != 'undefined' ||
            typeof(selectedDate.end) != 'undefined') {
            $scope.showDateRangeError = true;
          }
          return;
        }
      } else {
        $scope.showDateRangeError = false;
      }



        $scope.convertTime = function (time) {
          return moment(time).format('MMM D, YYYY h:mma');
        };

      $scope.busy = true;
      //console.log('updating logs:', $scope.busy);

      if (!preserveCount) {
        // switching fetching criteria
        noMoreResults = false;
        $scope.logs = [];
        logsRange.start = 0;
      }
      //console.log(logsRange.start);
      // populate the parameters for log sorting
      // depending from the page parameters.
      parameters.start = logsRange.start;
      parameters.count = logsRange.count;

      parameters.substring = $scope.search.description;

      parameters.sortBy = $scope.sortBy;
      parameters.invertSort = $scope.sortReverse;

      if ($scope.filterSeverity > 0) {
        parameters.severity = $scope.filterSeverity;
      }

      // TODO: change to parametrized function
      $serverLogs.getLogs(parameters)
        .then(
        function (results) {
          if (results.length > 0) {
            $scope.logs = $scope.logs.concat(results)

          } else {
            noMoreResults = true;
          }
          $scope.busy = false;
        }, function (err) {
          $scope.busy = false;
        }
      );

    };

    function isCorrectDateRange(start, end) {
      return  typeof(start) != 'undefined'
        && typeof(end) != 'undefined'
        && end.valueOf() > start.valueOf()
    }

    $scope.updateStartDate = function (newValue) {
      $scope.searchInterval = 'range';
      selectedDate.start = newValue;
      $scope.updateLogs();
    };

    $scope.updateEndDate = function (newValue) {
      // consider endDate the end of the day'
      $scope.searchInterval = 'range';
      selectedDate.end = newValue
        .add(24, 'hours')
        .subtract(1, 'seconds');
      $scope.updateLogs();
    };

    $scope.updateLogs();

  }])
;
