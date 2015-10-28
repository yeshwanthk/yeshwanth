'use strict';

angular.module('cv.ordering.shared', ['cc'])
  .factory('currencyConversionFactory', ['ccCurrencySymbol', function (ccCurrencySymbol) {
      return {
          convert: function convert(isoCode) {
              var currency = null;
              //convert the ISO4217 currency symbol received to a symbol, for ordering purposes
              if (ccCurrencySymbol[isoCode] != null) {
                  currency = ccCurrencySymbol[isoCode];
              } else {
                  currency = isoCode;
                  console.error('ISO4217 currency code not supplied by server or not found in lookup table');
              }
              return currency;
          }
      }
  }])
  .factory('installOptionsFactory', [function () {

      var getInstallType = function (installOptions, noEitherAllowed) {
          var io = installOptions;
          if (!io) {
              return "";
          } // shortcut if installOption is undefined

          var activeIO = _.filter(io, 'active');
          var option = "";

          // all active
          if ((io.length == activeIO.length) && (activeIO.length > 1)) {
              if (noEitherAllowed) {
                  option = getDefaultInstallType(installOptions);
              } else {
                  option = "either";
              }
          } else {
              // select first active
              option = activeIO[0].type;
          }

          return option;
      };

      var getDefaultInstallType = function (installOptions) {
          //console.log('getDefaultInstallType installOptions:', $scope.installOptions);
          if (!installOptions) {
              return "";
          } // shortcut if installOption is undefined

          for (var i = 0; i < installOptions.length; i++) {
              if (installOptions[i].active) {
                  return installOptions[i].type
              }
          }
      };

      //===================================
      // Update checkout basket
      //===================================
      var getInstallPrice = function (installOptions, installType) {
          if (!installOptions) {
              return 0;
          }

          var option = _.filter(installOptions, {'type': installType});
          var price = 0;
          if (option &&
            option.length &&
            option[0] &&
            option[0].hasOwnProperty('price')
          ) {
              price = Number(option[0].price);
          } else {
              price = 0;
          }

          return price;
      };

      return {
          getInstallType:        getInstallType,
          getDefaultInstallType: getDefaultInstallType,
          getInstallPrice:       getInstallPrice
      }
  }])
  .factory('buildOrderFactory', function () {
      var buildDeviceList = function (allDevices, addressList) {
          var devices = [];
          for (var i = 0; i < allDevices.length; i++) {

              var deviceAddress = addressList[allDevices[i].addressId];
              var mapboxAddress = [deviceAddress.address1, deviceAddress.address2, deviceAddress.city,
                  deviceAddress.country, deviceAddress.zip].filter(function (field) {
                    return field;
                }).join(", ");

              devices[i] = {
                  "type":     allDevices[i].deviceTypeId,
                  "shipping": allDevices[i].addressId,
                  "location": {
                      "address":  mapboxAddress,
                      "address1": deviceAddress.address1,
                      "address2": deviceAddress.address2,
                      "city":     deviceAddress.city,
                      "country":  deviceAddress.country,
                      "zip":      deviceAddress.zip,
                      "lo":       deviceAddress.lo,
                      "la":       deviceAddress.la
                  }
              };

              // add installType
              if (allDevices[i].hasOwnProperty('installType')) {
                  devices[i].installType = allDevices[i].installType;
              }
          }
          return devices;
      };

      return {
          buildDeviceList: buildDeviceList
      }
  })
  .filter('removeDecimal', function () {
      return function (str) {
          var decimal = str.substr(str.length, -2);
          return (decimal == 0) ? str.replace(".00", "") : str;
      };
  });


