'use strict';

angular.module('cv.devices', [
  'cv.server.devices',
  'cv.components.slider',
  'cv.components.deviceCard',
  'cv.performanceGraph',
  'blockUI'
])
  .controller('DevicesController', [
    '$rootScope',
    '$scope',
    'serverDevices',
    'CONST',
    'serverServices',
    'supportedDeviceTypes',
    '$q',
    'blockUI',
    '$translate',
    function (
      $rootScope,
      $scope,
      serverDevices,
      CONST,
      serverServices,
      supportedDeviceTypes,
      $q,
      blockUI,
      $translate) {
      //$(document).find('body').css('overflow', 'hidden');

      var deviceStatesOrder = {
        'not.found':0,

        'new':1,
        'invalid.serial':2,
        'hotswap':3,
        'unused':4,
        'validating':5,
        'registering':6,
        'offline':7,
        'registered':8,
        'needs.edit':9,

        'deleting': 10,

        'ready':20
      };

      var SETUP_STATE = serverDevices.SETUP_STATE;

      var updateDevicesTimer = null;
      var updateDevicesFrequency = 5 * 60 * 1000; // every 5 minutes
      var newDeviceSetupState = '';
      var loaders = {};
      $scope.scrollToSelected = false;
      $scope.tempSelectedLocation = null;

      var deviceInputError = {
        'serialId.duplicate': 'shared.input.error.serial.message',
        'general': 'errors.unknown'
      };

      function getErrorKey(err){
        if(err == 'serialId.duplicate') {
          return deviceInputError[err];
        } else {
          return deviceInputError['general'];
        }
      }

      // TODO: change all new properties added to devices, NOT from api. Prepend variable with underscore "_"

      $rootScope.$broadcast('app:changePageTitle', 'DASHBOARD.HEADER_DEVICES');

      // on page close
      $scope.$on("$destroy", function(){
        stopUpdateDevices();
      });

      /** **********************************************
       * Scope functions
       */
      $scope.startAddDevice = function($event) {

        // prevent click from propagation, causing deselection
        if($event) $event.stopPropagation();

        // Need to clear search and filters to new added cards are displayed
        $scope.filterSelected = $scope.filterList[0];
        $scope.searchString = "";

        // already in adding device state
        if(newDeviceSetupState == 'adding') return;
        newDeviceSetupState = 'adding';

        var device = addNewPendingDevice();
        // add temp to all devices so it shows up in the list
        $scope.allDevices[device.id] = device;

        // update device list
        $scope.filterDevices();
        // select new device
        $scope.selectDevice(device.id);
      };

      $scope.isHotSwapFormValid = function(){
        //console.log("isHotSwapFormValid:", $scope.hotswapForm);
        if($scope.hotswapForm) {
          return $scope.hotswapForm.$invalid || $scope.hotswapForm.serialId.$pristine;
        } else {
          return false;
        }
      };

      $scope.focusNewDevice = function(device) {
        // TODO: move this to meta data
        $scope.focusedNewDevice = device;
        $scope.migrateNewDevice(device);
      };


      $scope.focusNewDeviceIdx = function(deviceIdx) {
        $scope.currentNewDeviceIdx = deviceIdx;
      };

      $scope.isNewDeviceFocused = function(device) {
        return( $scope.isDeviceState(device, 'new') &&
        !$scope.isDeviceMissingSerial(device) &&
        (device.id == $scope.focusedNewDevice.id) );
      };

      $scope.migrateNewDevice = function(updatedNewDevices) {

        $scope.newDevices = updatedNewDevices;

        // device has been deleted so unselected device
        removeAllNewDevicesWithoutSerial();

        // update device list
        $scope.filterDevices();

        // select first new device
        if($scope.newDevices.length > 0){
          $scope.selectDevice($scope.newDevices[0].id);
        }
      };


      $scope.cancelNewDevice = function(){
        newDeviceSetupState = ''; // reset newDeviceSetupState
        // clear all new devices
        $scope.newDevices = [];

        // remove all new devices from allDevices list
        removeNotSavedDevices();

        // update device list
        $scope.filterDevices();

        // remove selectedDevice
        $scope.deselectDevice();
      };


      $scope.updateSearch = function(searchString) {
        // update searchString
        $scope.searchString = searchString;

        // update device order
        $scope.filterDevices();
        // device has been deleted so unselect device
        $scope.deselectIfSelectedDeviceNotVisible();
      };

      $scope.deselectDevice = function() {
        // get list of validDevices
        var validDevices = _.filter($scope.newDevices, function (device){
          return (device.serialId != '');
        });

        // if exiting new devices AND no valid devices,
        // then clear add new devices state and remove all newDevices
        if($scope.sidebarView == 'new-device-adding' &&
          !validDevices.length) {
          newDeviceSetupState = '';
          $scope.newDevices = [];
        }

        $scope.selectedDevice.id = null;
        $scope.selectedDevice.info = null;
        updateSidebar($scope.selectedDevice.info);
      };

      $scope.getNumDevices = function(){
        return _.keys($scope.devices).length;
      };

      //
      $scope.deselectIfSelectedDeviceNotVisible = function() {
        if(!$scope.devices.hasOwnProperty($scope.selectedDevice.id)) {
          $scope.deselectDevice();
        }
      };

      $scope.clickDeselectDevice = function() {
        // remove selectedDevice
        $scope.deselectDevice();
      };

      $scope.selectFilter = function(filter, $event) {
        // prevent click from propagtion, causing deselection
        if($event) $event.stopPropagation();

        $scope.filterSelected = filter;

        $scope.filterDevices();
        $scope.deselectIfSelectedDeviceNotVisible();
      };

      $scope.selectDevice = function(id) {
        //console.log("selectDevice id:", id);
        $scope.scrollToSelected = true;
        $scope.selectedDevice.id = id;
      };

      $scope.filterDevices = function() {
        $scope.devices = $scope.filterFilterDevices($scope.allDevices);
        $scope.devices = $scope.searchFilterDevices($scope.devices);
        //console.log("filterDevices allDevices:", $scope.allDevices);
        //console.log("filterDevices devices:", $scope.devices);
      };

      $scope.filterFilterDevices = function(allDevices) {
        // using selected filter index, get status for filter
        var filterSelectedStatus = $scope.filterSelected.status;
        //console.log('filterSelectedStatus:', filterSelectedStatus);

        // wildcard, aka ALL
        if(filterSelectedStatus === "*") {
          // return all
          return allDevices;
        } else {
          // build list of devices
          var devices = {};
          for(var devideId in allDevices) {
            //console.log('filterFilterDevices serialId:', allDevices[devideId].serialId,', state:', allDevices[devideId].state);
            if( _.includes(filterSelectedStatus, allDevices[devideId].state) ) {
              devices[devideId] = allDevices[devideId];
            }
          }

          return devices;
        }
      };

      $scope.searchFilterDevices = function(allDevices) {
        // using selected filter index, get status for filter
        var search = $scope.searchString.toLowerCase();

        // wildcard, aka ALL
        if(!search || search.length < 0) {
          return allDevices;
        } else {
          // build list of devices
          var devices = {};
          for(var deviceId in allDevices) {

            var addDevice = false;
            var val = JSON.stringify(allDevices[deviceId]);
            val = val.toLowerCase();
            if(val.indexOf(search) > -1) {
              addDevice = true;
            }

            if(addDevice) {
              devices[deviceId] = allDevices[deviceId];
            }
          }

          return devices;
        }
      };

      $scope.isSerialAlreadyInUse = function(deviceId, serialId) {
        var inUse = false;
        // don't compare empty serials
        if(!serialId || !serialId.length) {
          return false;
        }

        // look at all devices for serialId
        for(var dId in $scope.allDevices){
          if( (dId != deviceId) &&
            $scope.allDevices[dId].serialId &&
            ($scope.allDevices[dId].serialId.length > 0) &&
            ($scope.allDevices[dId].serialId == serialId)
          ) {
            //console.log("deviceId:", deviceId, ", allDevices:", $scope.allDevices[dId]);
            inUse = true;
            break;
          }
        }

        return inUse;
      };

      $scope.onNameEdit = function(name) {
        if( $scope.isNameAlreadyInUse($scope.selectedDevice.info.id, name) ) {
          $scope.selectedDevice.info.error = 'device_name.duplicate';
          return true;
        } else {
          delete $scope.selectedDevice.info.error;
          return false;
        }
      };

      $scope.isNameAlreadyInUse = function(deviceId, name) {
        var inUse = false;
        // don't compare empty serials
        if(!name || !name.length) {
          return false;
        }

        // look at all devices for serialId
        for(var dId in $scope.allDevices){
          if( (dId != deviceId) &&
            $scope.allDevices[dId].name &&
            ($scope.allDevices[dId].name.length > 0) &&
            ($scope.allDevices[dId].name == name)
          ) {
            //console.log("deviceId:", deviceId, ", allDevices:", $scope.allDevices[dId]);
            inUse = true;
            break;
          }
        }

        return inUse;
      };

      $scope.applyDeviceSerial = function(device) {

        if(!device.serialId || !device.serialId.length || $rootScope.queue.disableEdit === true) {
          return false;
        }

        // remove error, so if success it will not have an error, otherwise it will add a new one
        if(device.error) {
          delete device.error;
        }

        // reset editing device
        $scope.stopEditingDeviceInfo('unused.serialId');

        startLoader('sidebarUnused');
        serverDevices.setDeviceSerial(device.id, device.serialId)
          .then(function(deviceInfo) {

            //device = _.merge(device, deviceInfo);
            device.setupState = device.setupState | SETUP_STATE.REG; // make device registered

            updateDeviceState(device);

            //console.log('applyDeviceSerial device:', _.cloneDeep(device));

            // selected device could have changed in the background
            if(device.id == $scope.selectedDevice.id) {
              updateSidebar($scope.selectedDevice.info);
            } else {
              stopLoader('sidebarUnused');
            }
          })
          .catch(function(response){
            // clear out serialId as it's invalid
            device.serialId = '';
            if(response) {
              // could be dup serial
              device.error = response.error;
              device.errorKey = getErrorKey(response.error);
              //console.error("Error:", err);
            }

            updateDeviceState(device);

            stopLoader('sidebarUnused');
          });
      };

      $scope.saveLocation = function(location) {

        if (location) {
          location.la = String(location.la);
          location.lo = String(location.lo);
        }
        $scope.selectedDevice.info.location = location;

        serverDevices.setDeviceInfo(
          $scope.selectedDevice.info.id,
          $scope.selectedDevice.info.name,
          $scope.selectedDevice.info.location)
          .then(function(){
            // done
          });
      };

      $scope.saveSelectedDeviceName = function(){
        $scope.stopEditingDeviceInfo('name');

        serverDevices.setDeviceInfo(
          $scope.selectedDevice.info.id,
          $scope.selectedDevice.info.name,
          $scope.selectedDevice.info.location);
      };

      function validateDevicesSerial(devices) {
        var promiseList = [];
        devices.forEach(function(device) {
          // remove error, so if success it will not have an error, otherwise it will add a new one
          if (device.error) {
            delete device.error;
          }

          var p = serverDevices.validateDeviceSerial(device.serialId)
            .then(function(createdDevice) {

              createdDevice = _.cloneDeep(createdDevice);
              createdDevice.valid = true;

              //console.log('addDevice createdDevice:', createdDevice);
              return {device: createdDevice};
            },
            function(response){
              //console.error('addDevice device:', device, ', error:', response.error);
              response.device = device;
              return response;
            });

          promiseList.push(p);
        });

        return $q.all(promiseList)
          .then(function(allPromiseResults){
            //console.log("validateDevicesSerial allPromiseResults:", allPromiseResults);
            // clear newDevices, so it will be filled in results loop
            $scope.newDevices = [];

            var hasError = false;

            allPromiseResults.forEach(function(result) {
              // an error occurred
              if(result.hasOwnProperty('error')) {
                // TODO: get this really working, UI highlight and what not
                hasError = true;
                result.device.saved = false;
                result.device.error = result.error;
                result.device.errorKey = getErrorKey(result.error);
                //console.log('validateDevicesSerial device:', result.device);
              }

              // add device back to newDevices List
              $scope.newDevices.push(result.device);
            });

            return hasError;
          });
      }

      function addDevices(devices) {
        var addDevicePromiseList = [];
        //console.log('addDevices start');

        devices.forEach(function(device) {
          // remove error, so if success it will not have an error, otherwise it will add a new one
          if(device.error) {
            delete device.error;
          }

          //console.log('addDevices serialId:', device.serialId);
          var p = serverDevices.addDevice(device.serialId)
            .then(function(createdDevice) {

              // update values from server (mainly the serialId)
              createdDevice = _.merge(device, createdDevice);
              // set new created device to new state, so it can show in the setup step
              createdDevice.saved = true;
              createdDevice.setup = true;
              //console.log("addDevice createdDevice:", createdDevice);

              updateDeviceState(createdDevice);

              // find and replace device
              for(var deviceId in $scope.allDevices) {
                // find a device that has the same serialId (there should not exist two+ devicesw with the same serialId)
                if($scope.allDevices[deviceId].serialId == createdDevice.serialId) {
                  // add new created device
                  $scope.allDevices[createdDevice.id] = _.merge($scope.allDevices[deviceId], createdDevice);
                  // remove old device
                  delete $scope.allDevices[deviceId];
                }
              }
              //

              //console.log('addDevice createdDevice:', createdDevice);
              return {device: createdDevice};
            },
            function(response){
              //console.error('addDevice device:', device, ', error:', response.error);
              response.device = device;
              return response;
            });

          addDevicePromiseList.push(p);
        });

        return $q.all(addDevicePromiseList)
          .then(function(allPromiseResults){
            //console.log('addDevices all done');

            // clear newDevices, so it will be filled in results loop
            $scope.newDevices = [];

            var continuteToSetup = true;
            // Q does not reject from previous rejections!
            // need to handle error from catch is not called :/
            allPromiseResults.forEach(function(result) {

              // an error occurred
              if(result.hasOwnProperty('error')) {
                // TODO: get this really working, UI highlight and what not
                continuteToSetup = false;
                result.device.saved = false;
                result.device.error = result.error;
                result.device.errorKey = getErrorKey(result.error);
                //console.log('addDevices device:', result.device);
              }

              // add device back to newDevices List
              $scope.newDevices.push(result.device);
            });

            //console.log('addDevices updated devices');
            if(continuteToSetup) {
              newDeviceSetupState = 'setup';
            } else {
              var errorsList = _.pluck($scope.newDevices, 'error');

              var errorText = "";
              if(errorsList.length > 0) {
                // only check first error
                var error = errorsList[0];
                errorText += $translate.instant('ERRORS.UNKNOWN') + ' ';

                if(error == 'serialId.duplicate') {
                  errorText += $translate.instant('ERRORS.'+error.toUpperCase());
                }
              }

              // popup error message
              // TODO: cv-alert-popup should allow for an array messaage or key input
              $rootScope.$emit('global:error', {message: errorText});

              // make sure there is a new device for edit
              addNewPendingDevice();

              // set newDeviceSetupState back to adding
              newDeviceSetupState = 'adding';
            }

            stopLoader('sidebarAdding');

            // update currentNewDeviceIdx from current selected device
            $scope.changeCurrentNewDevice(0);
            updateSidebar($scope.selectedDevice.info);

            // update all devices if there was an error
            removeAllNewDevicesWithoutSerial();

            // update device list
            $scope.filterDevices();
          });
      }

      $scope.doesNewDeviceHasError = function() {
        var hasError = false;

        for(var i = 0; i < $scope.newDevices.length; i++) {
          if($scope.newDevices[i].error) {
            hasError = true;
          }
        }

        //console.log('doesNewDeviceHasError newDevices:', hasError);
        return hasError;
      };

      $scope.hasValidNewDevice = function(){
        return ( ($scope.newDevices.length - 1 > 0) &&
        !$scope.doesNewDeviceHasError() );
      };

      $scope.associateNewDevices = function() {

        if($rootScope.queue.disableEdit === false) {

        // short cut if no valid new device
        if(!$scope.hasValidNewDevice()) return;

        // clear all devices with no serial
        var _newDevices = getNewDevicesWithSerial();

        startLoader('sidebarAdding');

        // first validate serials
        validateDevicesSerial(_newDevices)
          .then(function(hasError){
            if(!hasError) {
              // if all ok, then add devices
              return addDevices(_newDevices);
            } else {
              stopLoader('sidebarAdding');
            }
          });
        }
      };

      $scope.finishNewDeviceSetup = function() {
        var firstDeviceId = null;

        if($scope.newDevices[0]) {
          firstDeviceId = $scope.newDevices[0].id;
        }

        //console.log('finishNewDeviceSetup newDevices:', $scope.newDevices);
        // set setup to false for all devices
        for(var deviceId in $scope.allDevices) {
          if($scope.allDevices[deviceId].setup) {
            $scope.allDevices[deviceId].setup = false;
          }
        }

        // remove new devices
        $scope.newDevices = [];
        newDeviceSetupState = '';

        // update all device states for all newly setup devices
        updateAllDeviceStates();

        if(firstDeviceId) {
          $scope.selectDevice(firstDeviceId);
        } else {
          $scope.deselectDevice();
        }

        updateSidebar($scope.selectedDevice.info);
        //console.log("finishNewDeviceSetup allDevices:", _.cloneDeep($scope.allDevices));
      };

      $scope.changeCurrentNewDevice = function(newIdx) {

        // check bounds
        if(newIdx < 0) newIdx = 0;
        if(newIdx >= $scope.newDevices.length) newIdx = $scope.newDevices.length - 1;

        $scope.currentNewDeviceIdx = newIdx;

        $scope.selectedDevice.info = $scope.newDevices[$scope.currentNewDeviceIdx];
        $scope.selectedDevice.id = $scope.selectedDevice.info.id;

        return  $scope.selectedDevice.info;
      };

      $scope.saveTempLocation = function(location) {

        if (!location) {
          return;
        }

        var newLocation = {};
        if (location.geo) {
          newLocation = {address: location.address, la:location.geo.la, lo:location.geo.lo, suggestion: location.suggestion};
        }

        $scope.tempSelectedLocation = newLocation;
      };

      $scope.applyDeviceEdit = function() {

        updateDeviceState($scope.selectedDevice.info);
        updateSidebar($scope.selectedDevice.info);

        if($scope.tempSelectedLocation) {
          var location = {la: String($scope.tempSelectedLocation.la),
                          lo: String($scope.tempSelectedLocation.lo),
                          address: $scope.tempSelectedLocation.address};
          $scope.selectedDevice.info.location = location;
        }

        serverDevices.setDeviceInfo(
          $scope.selectedDevice.info.id,
          $scope.selectedDevice.info.name,
          $scope.selectedDevice.info.location)
          .then(function() {
            // done
          });

        $scope.viewDetails();
      };

      /** **********************************************
       * Change View Scope Functions
       */

      $scope.viewDetails = function() {
        $scope.sidebarView = 'details';
      };

      $scope.viewUnused = function() {
        $scope.sidebarView = 'unused';
      };


      /** **********************************************
       * Private Functions
       */
      function removeAllNewDevicesWithoutSerial(){
        // clear all devices with no serial
        //$scope.newDevices = getNewDevicesWithSerial();

        // remove all new devices from allDevices list
        removeNotSavedDevices();

        // add all newDevices back into allDevice list
        for(var i = 0; i < $scope.newDevices.length; i++) {
          $scope.allDevices[$scope.newDevices[i].id] = $scope.newDevices[i];
        }
      }

      function addNewPendingDevice() {

        // Add a new incomplete entry to the devices array
        var device = $scope.createNewDeviceObject();

        // add device to new device list
        $scope.newDevices.push(device);

        return device;
      }

      function isInAllDeviceList(device) {
        return $scope.allDevices.hasOwnProperty(device.id);
      }

      function removeNotSavedDevices() {
        for(var deviceId in $scope.allDevices) {
          if(!$scope.allDevices[deviceId].saved) {
            delete $scope.allDevices[deviceId];
          }
        }
      }

      function updateSidebar(device, dontScroll){
        if(!$scope.scrollToSelected && dontScroll) {
          $scope.scrollToSelected = false;
        } else {
          $scope.scrollToSelected = true;
        }
        //console.log("updateSidebar dontScroll:", dontScroll, ", scrollToSelected:", $scope.scrollToSelected, ", device:", device);

        // stop loader just in case
        stopLoader('sidebarAdding');
        stopLoader('sidebarUnused');

        if(!device || !device.state) {
          $scope.sidebarView = '';
          return;
        }

        //console.log('updateSidebar state:', device.state);

        if( device.state == 'registered') {
          $scope.sidebarView = 'registered';
        }
        else if( newDeviceSetupState != '' && isInNewDeviceList(device) ) {
          // adding or registering
          if(newDeviceSetupState != 'setup') {
            $scope.sidebarView = 'new-device-adding';
          }
          else if(
            (newDeviceSetupState == 'setup') &&
            ($scope.isDeviceMissingSerial(device) || isDeviceNeedsEdit(device))
          ) {
            $scope.sidebarView = 'new-device-setup';
            // update current not setup device idx
            $scope.currentNewDeviceIdx = findNewDeviceInxById(device.id);
          }
        }
        else if( device.state == 'unused') {
          $scope.sidebarView = 'unused';
        }
        else if( device.state == 'validating') {
          $scope.sidebarView = 'unused';
        }
        else if( device.state == 'invalid.serial') {
          $scope.sidebarView = 'unused';
        }
        else if( device.state == 'needs.edit' ||
          isDeviceNeedsEdit(device)) {
          $scope.sidebarView = 'needs-edit';
        }
        else {
          $scope.sidebarView = 'details';
        }

        //console.log("updateSidebar sidebarView:", $scope.sidebarView, $scope.devices);
      }

      function updateDeviceState(device) {
        if(!device) return;

        device.state = getDeviceState(device);
        //console.log('updateDeviceState device:', device);
      }

      function getNewDevicesWithSerial() {
        var _newDevices = [];
        for(var i = 0; i < $scope.newDevices.length; i++) {
          if(!$scope.isDeviceMissingSerial($scope.newDevices[i])) {
            _newDevices.push($scope.newDevices[i]);
          }
        }
        return _newDevices;
      }

      function getUnsavedNewDevices() {
        var _newDevices = [];
        for(var i = 0; i < $scope.newDevices.length; i++) {
          if(!$scope.newDevices[i].saved) {
            _newDevices.push($scope.newDevices[i]);
          }
        }
        return _newDevices;
      }


      function updateAllDeviceStates() {
        for(var deviceId in $scope.allDevices) {
          updateDeviceState($scope.allDevices[deviceId]);
        }
      }

      function updateDevices() {
        $scope.isLoadingDevices = true;
        $scope.scrollToSelected = false;

        //console.log('start getting devices....');
        return serverDevices.getDevices()
          .then(function (newAllDevices) {

            var editingDeviceId = null; // can only edit one at a time
            // find device editing
            for(var deviceId in $scope.allDevices) {
              if( _.contains( _.values($scope.allDevices[deviceId]._editing), true) ) {
                editingDeviceId = deviceId;
                break;
              }
            }
            //console.log('editingDeviceId', editingDeviceId);


            // check if user is editing device
            var tempInto = null;
            if( (editingDeviceId != null) &&
              ($scope.allDevices.hasOwnProperty(editingDeviceId))
            ) {
              // save device info (name, location)...
              tempInto = {
                name:     $scope.allDevices[editingDeviceId].name,
                location: _.cloneDeep($scope.allDevices[editingDeviceId].location),
                serialId: $scope.allDevices[editingDeviceId].serialId
              };
            }

            $scope.allDevices = _.merge($scope.allDevices, newAllDevices);

            if( (editingDeviceId != null) &&
              ($scope.allDevices.hasOwnProperty(editingDeviceId))
            ) {
              // save device info (name, location)...
              $scope.allDevices[editingDeviceId].name     = tempInto.name;
              //console.log("tempInto.location");
              //console.log(tempInto.location);
              $scope.allDevices[editingDeviceId].location = tempInto.location;

              //console.log("editingDevice.serialId:", $scope.allDevices[editingDeviceId].serialId, 'tempInto.serialId:', tempInto.serialId);

              // if editing serialId during setup
              if( !$scope.allDevices[editingDeviceId].serialId ||
                !$scope.allDevices[editingDeviceId].serialId.length ) {
                $scope.allDevices[editingDeviceId].serialId = tempInto.serialId;
              }
            }

            // update all device states
            updateAllDeviceStates();

            // delete all devices NOT in newAllDevices that are in allDevices that are saved
            for(var deviceId in $scope.allDevices) {
              if( !newAllDevices.hasOwnProperty(deviceId) &&
                $scope.allDevices[deviceId].saved ){
                delete $scope.allDevices[deviceId];
              }
            }

            // Run filter over devices
            $scope.filterDevices();

            // device has been deleted so not selected
            $scope.deselectIfSelectedDeviceNotVisible();

            // update the sidebar
            updateSidebar($scope.selectedDevice.info, true);

            //console.log('done updating devices');
            $scope.isLoadingDevices = false;
          });
      }

      function startUpdateDevices() {
        // stop interval before start it
        stopUpdateDevices();

        updateDevicesTimer = setTimeout(function(){
          updateDevices()
            .then(function(){
              // when api is done, start next api request
              startUpdateDevices();
            });
          //console.log("Updated Devices - allDevices:", _.cloneDeep($scope.allDevices));
        }, updateDevicesFrequency);
      }

      function stopUpdateDevices() {
        if(updateDevicesTimer) {
          clearInterval(updateDevicesTimer);
        }
      }

      function init() {
        /** **********************************************
         * Scope variables
         */
        $scope.supportedDeviceTypes = supportedDeviceTypes;
        $scope.CONST = CONST;

        //Current right-hand view
        $scope.sidebarView = 'details';
        $scope.newDevices = [];
        $scope.currentNewDeviceIdx = 0;
        $scope.focusedNewDevice = null;

        /*
         'not.found':0,
         'new':1,
         'invalid.serial':2,
         'hotswap':3,
         'unused':4,
         'validating':5,
         'registering':6,
         'offline':7,
         'registered':8,
         'needs.edit':9,
         'deleting': 10,
         'ready':20
         */
        $scope.filterList = [
          { name: "DEVICES.FILTERS.ALL",     status:"*"},
          { name: "DEVICES.FILTERS.OFFLINE", status:["offline", "deleting", "registered"]},
          { name: "DEVICES.FILTERS.UNUSED",  status:["unused", "registering", "validating", "hotswap", "invalid.serial", "new", "not.found"]},
          { name: "DEVICES.FILTERS.ONLINE",  status:["ready", "needs.edit", "degraded"]}
        ];
        $scope.filterSelected = $scope.filterList[0];
        $scope.searchString = "";

        $scope.allDevices = {};
        $scope.devices = {};
        $scope.selectedDevice = {
          id: null, // TODO: should this be removed
          info: null,
          sliderValue: 10
        };

        $scope.serverDevices = serverDevices;
        $scope.tempInput = "";

        $scope.stopEditingDeviceInfo('unused.serialId');
        $scope.stopEditingDeviceInfo('name');


        // get devices the first time, send true to show loader
        $scope.showLoader = true;
        updateDevices()
          .then(function(){
            $scope.showLoader = false;
            startUpdateDevices();
          });
      }

      /** **********************************************
       * Scope Watch Functions
       */
      $scope.$watch('selectedDevice.id', function(deviceId) {
        if(!deviceId) return;

        updateSidebar($scope.allDevices[deviceId]);
        // update device info from id
        $scope.selectedDevice.info = $scope.allDevices[deviceId];
      });

      $scope.$watch('selectedDevice.info', function() {
        //console.log('devices $watch selectedDevice.info:', $scope.selectedDevice.info);
        if( $scope.selectedDevice &&
          $scope.selectedDevice.info ) {

          // keep device state in sync
          updateDeviceState($scope.selectedDevice.info);
        }
      });

      $scope.onScrolling = function(isScrolling) {
        $scope.scrollToSelected = isScrolling; // set show selection to false, so when it gets set to true again it will force scroll
      };

      $scope.deviceHasError = function(device){
        return !!(device.error);
      };

      $scope.isInvalidSerial = function(serialId) {
        var deviceId = $scope.selectedDevice.info.id;

        if( (newDeviceSetupState == 'adding') &&
          ( $scope.newDevices &&
          $scope.currentNewDeviceIdx &&
          $scope.newDevices[$scope.currentNewDeviceIdx]
          ) ) {
          deviceId = $scope.newDevices[$scope.currentNewDeviceIdx].id;
        }

        //console.log("isInvalidSerial currentNewDeviceIdx:", $scope.currentNewDeviceIdx, ", deviceId:", deviceId, ", serialId:", serialId);

        // update the editing device error
        return $scope.isSerialAlreadyInUse(deviceId, serialId);
      };

      $scope.updateAllNewDeviceErrors = function(newDeviceIdx){
        var hasError = false;
        //console.log("updateAllNewDeviceErrors newDeviceIdx:", newDeviceIdx);
        var editingDevice = $scope.newDevices[newDeviceIdx];
        //console.log("updateAllNewDeviceErrors editingDevice:", editingDevice);
        if(!editingDevice) { return hasError; }

        // update the editing device error
        if( $scope.isSerialAlreadyInUse(editingDevice.id, editingDevice.serialId)) {
          editingDevice.error = 'serialId.duplicate';
          hasError = true;
          //console.log("updateAllNewDeviceErrors editingDevice:", editingDevice);
        } else {
          //console.log('selectedDevice remove errors deviceId:', editingDevice);
          delete editingDevice.error;
          hasError = false
        }

        // update all other new device errors
        for(var i = 0; i < $scope.newDevices.length; i++) {
          // don't check against current editing device
          if(editingDevice.id != $scope.newDevices[i].id) {
            // check while changing new device serial
            if( !$scope.isSerialAlreadyInUse($scope.newDevices[i].id, $scope.newDevices[i].serialId)) {
              //console.log('selectedDevice remove errors deviceId:', $scope.newDevices[i]);
              delete $scope.newDevices[i].error;
            }
          }
        }

        return hasError;
      };


      /** **********************************************
       * Utility Scope Functions
       */
      $scope.createNewDeviceObject = function() {

        // temp item, should be removed when "associate"
        var id = (new Date()).getTime();

        var device = {
          "id": id.toString(),
          "serialId": '',
          "name":     '',
          "model":    '',
          "ip":       '',
          "status":   '',
          "trafficVolume": '',
          "connectionStatus": '',
          "usageGb": '',
          "setupState": (SETUP_STATE.NOPLUG | SETUP_STATE.NOREG),
          "location": {},
          "saved":    false,
          "services": [],
          "validateStep": ''
        };
        updateDeviceState(device);
        return device;
      };

      $scope.sortDeviceOrder = function(device) {
        var order = deviceStatesOrder[device.state];
        device.order = order;
        //console.log("sortDeviceOrder device:", device);
        return order;
      };

      $scope.isDeviceMissingSerial = function(device) {
        return (!device.serialId || !device.serialId.length);
      };

      $scope.isInNewDeviceSetup = function(){
        return (newDeviceSetupState != '');
      };

      $scope.isNewDeviceSetupState = function(state){
        return (newDeviceSetupState == state);
      };

      $scope.isDeviceState = function(device, state) {
        if( device &&
          device.state) {
          return (device.state == state);
        }
        return false;
      };

      $scope.shouldScrollToSelected = function(device) {
        //console.log('shouldScrollToSelected scrollToSelected:', $scope.scrollToSelected, ', isLoadingDevices:', $scope.isLoadingDevices);
        // only scroll if not loading and is selected
        return ( $scope.scrollToSelected &&
        $scope.isSelected(device) );
      };

      $scope.isSelected = function(device) {
        return (device.id == $scope.selectedDevice.id);
      };

      $scope.isLastNewDeviceIdx = function(){
        return ( $scope.currentNewDeviceIdx+1 != $scope.newDevices.length)
      };

      $scope.clearDeviceSerial = function(device) {
        device.serialId = "";
      };

      $scope.isSidebarVisible = function(){
        return ($scope.sidebarView && $scope.sidebarView.length);
      };

      $scope.startEditingDeviceInfo = function(type) {
        if($scope.selectedDevice.info != null) {
          if(!$scope.selectedDevice.info._editing) {
            $scope.selectedDevice.info._editing = {};
          }

          $scope.selectedDevice.info._editing[type] = true;
        }
      };

      $scope.stopEditingDeviceInfo = function(type) {
        if($scope.selectedDevice.info != null) {
          if(!$scope.selectedDevice.info._editing) {
            $scope.selectedDevice.info._editing = {};
          }

          $scope.selectedDevice.info._editing[type] = false;
        }
      };

      $scope.isEditingDeviceInfo = function() {
        return ($scope.editingDeviceId != null);
      };

      $scope.isDeviceSelected = function(){
        return !!($scope.selectedDevice && $scope.selectedDevice.id);
      };

      $scope.hasLocation = function(device) {
        return ( device &&
        device.location &&
        device.location.la &&
        device.location.lo);
      };

      // ------------------------------------------------------
      // Foundation modal's functions
      $scope.preventDelete = function() {
        var numDevices = 0;
        if ($scope.devices) {
          numDevices = Object.keys($scope.devices).length;
        }
        return (numDevices <= 1);
      };

      $scope.openModal = function(elmId) {

        // Do not allow the last device to be deleted.
        var numDevices = Object.keys($scope.devices).length;
        //console.log("elmId: " + elmId);
        //console.log("numDevices: " + numDevices);
        if (elmId == "deleteDeviceModal" && numDevices <= 1) {
          return;
        }

        // reset temp input
        $scope.tempInput = "";

        // stop all loaders at start, just in case a prev loader was running
        stopLoader('deleteDeviceModal');

        // using Jquery and Foundation reveal function for modal's
        $('#'+elmId).foundation('reveal', 'open');
      };

      $scope.closeModal = function(elmId) {
        // reset temp input
        $scope.tempInput = "";
        // using Jquery and Foundation reveal function for modal's
        $('#'+elmId).foundation('reveal', 'close');
      };
      // ------------------------------------------------------

      // TODO: move to device-panel, need to move "unused" panel
      $scope.deleteDevice = function() {
        var deviceToDelete = $scope.selectedDevice.info;

        // flag device for removal
        deviceToDelete.state = "deleting";
        deviceToDelete.processing = true; // used to show loader
        startLoader('deleteDeviceModal');
        serverDevices.deleteDevice(deviceToDelete.id)
          .then(function(){
            // deleted
            deviceToDelete.processing = false;

            if($scope.onDelete) {
              $scope.onDelete(deviceToDelete);
            }

            stopLoader('deleteDeviceModal');
            $scope.closeModal('deleteDeviceModal');
          })
          .catch(function(err){
            stopLoader('deleteDeviceModal');

            // could be dup serial
            console.error("Error:", err);
          });

        // device current selected device because it's being deleted
        //$scope.deselectDevice();
      };

      $scope.isLoaderShow = function(type) {
        type = $.camelCase(type);
        //console.log("isLoaderShow type:", type);

        if(loaders[type]) return loaders[type].show;
        else return false;
      };

      $scope.onDelete = function(device) {
        // remove device
        delete $scope.allDevices[device.id];

        // update device order
        $scope.filterDevices();
        // device has been deleted so unselect device
        $scope.deselectIfSelectedDeviceNotVisible();
      };

      $scope.onHotswap = function(device){
        updateDeviceState(device);
      };

      /** **********************************************
       * Utility Functions
       */

      function isInNewDeviceList(device) {
        for(var i = 0; i < $scope.newDevices.length; i++) {
          if($scope.newDevices[i].id == device.id) {
            return true;
          }
        }

        return false;
      }

      function isDeviceNeedsEdit(device) {
        return ( !device.name ||
        !device.name.length ||
        !device.location );
      }

      function findNewDeviceInxById(deviceId) {
        for(var i = 0; i < $scope.newDevices.length; i++) {
          if( $scope.newDevices[i].id == deviceId) {
            return i;
          }
        }
        return 0;
      }

      function findNewDeviceBySerialId(serialId) {
        for(var i = 0; i < $scope.newDevices.length; i++) {
          if( $scope.newDevices[i].serialId == serialId) {
            return $scope.newDevices[i];
          }
        }
        return null;
      }

      function startLoader(type){
        type = $.camelCase(type);
        //console.log("startLoader type:", type);

        if(!loaders[type]) {
          loaders[type] = {};
        }
        loaders[type].show = true;

        loaders[type].blockUI = blockUI.instances.get(type);
        if(loaders[type].blockUI) {
          loaders[type].blockUI.start();
        }

        //console.log("startLoader snake_case:", snake_case(type));
        var loaderElement = $("#"+snake_case(type));
        //console.log("startLoader loaderElement:", loaderElement);
        if(loaderElement) {
          loaderElement.show();
        }
      }

      function stopLoader(type){
        type = $.camelCase(type);
        //console.log("stopLoader type:", type);

        if(!loaders[type]) {
          loaders[type] = {};
        }
        loaders[type].show = false;

        if( loaders.hasOwnProperty(type) &&
          loaders[type] &&
          loaders[type].blockUI ) {
          loaders[type].blockUI.stop();
        }

        //console.log("stopLoader snake_case:", snake_case(type));
        var loaderElement = $("#"+snake_case(type));
        if(loaderElement) {
          loaderElement.hide();

        }
      }

      $scope.isNewAndNoSerial = function(device) {
        return ( device &&
        device.state == 'new' &&
        $scope.isDeviceMissingSerial(device) );
      };

      function getDeviceState(device) {
        var state = '';
        //console.log('getDeviceState:', _.cloneDeep(device));

        // registered but NOT plugged
        if(  (device.setupState & SETUP_STATE.REG) &&
          !(device.setupState & SETUP_STATE.PLUG) )  {
          state = 'registered';
        }
        else if( (!device.saved || device.setup) ||
          ( (newDeviceSetupState != '') &&
          isInNewDeviceList(device) )
        ) {
          state = 'new';
        }
        else if( device.error &&
          device.error == 'serialId.duplicate') {
          state = 'invalid.serial';
        }
        else if( $scope.isDeviceMissingSerial(device) ||
          (device._editing && device._editing['unused.serialId'])
        ) {
          state = 'unused';
        }
        else if (device.status == 'degraded') {
          state = "degraded";
        }
        else if(device.status == 'offline') {
          state = 'offline';
        }
        else if(
          !$scope.isDeviceMissingSerial(device) &&
          isDeviceNeedsEdit(device) ) {
          state = 'needs.edit';
        }
        else if(
          !$scope.isDeviceMissingSerial(device) &&
          !isDeviceNeedsEdit(device) ) {
          state = 'ready';
        }
        else {
          state = 'not.found';
        }

        //console.log('getDeviceState state:', state, ', name:', device.name, ', deviceId:', device.id, ', setupState:', device.setupState);
        return state;
      }

      // from angular code
      var SNAKE_CASE_REGEXP = /[A-Z]/g;
      function snake_case(name, separator) {
        separator = separator || '-';
        return name.replace(SNAKE_CASE_REGEXP, function(letter, pos) {
          return (pos ? separator : '') + letter.toLowerCase();
        });
      }


      /** **********************************************
       * Initialize data and scope variables
       */
      init();

    }])
  .filter('objOrder', function () {
    return function(object) {
      var array = [];
      //console.log("objOrder object:", object);
      for(var key in object) {
        array.push(object[key]);
      }
      //console.log("objOrder array:", array);
      return array;
    };
  });
;
