//=============================================================
// Language Factory - local, cookie and server language get/set
//=============================================================
angular.module('cv.language', ['tmh.dynamicLocale'])
  .config(['tmhDynamicLocaleProvider', function (tmhDynamicLocaleProvider) {
      //allows for dynamic locale switching after program start,
      //specifically for allowing locale-based Moment and angular-currency patterns
      //to update dynamically on language change
      tmhDynamicLocaleProvider.localeLocationPattern('/customization/i18n/angular-i18n/angular-locale_{{locale}}.js');
  }])
  .factory('LanguageFactory', ['$rootScope', '$translate', 'tmhDynamicLocale', 'serverAccount', '$cookieFactory', '$q',
      function ($rootScope, $translate, tmhDynamicLocale, serverAccount, $cookieFactory, $q) {

          // Server does not provide the language names for us,
          // they only provide the country code (ex. en_US)
          // Thus, we need to provide this lookup table ourselves
          var languageNameLookupTable = {
              "en_US": "English",
              "hu_HU": "Magyar",
              "sk_SK": "Slovak",
              "hr_HR": "Hrvatski",
              "de_DE": "Deutsch",
              "fr_FR": "Francais",
              "it_IT": "Italiano"
          };

          var language = {
              currentLanguageKey: "",
              availableLanguages: []
          };

          //=======================================================================
          var langList = [];
          //=======================================================================
          var buildLanguageList = function () {
              langList = [];
              var langKeyList = $cookieFactory.getLanguages();
              if(!langKeyList) {
                langKeyList = _.keys(languageNameLookupTable);
              }

              if (langKeyList != null) {
                  for (var i = 0; i < langKeyList.length; i++) {
                      var key = langKeyList[i];
                      var language = {};
                      language.id = key;
                      language.name = languageNameLookupTable[key];
                      language.icon = '/images/languages/' + language.id + '.png';
                      langList.push(language);
                  }
              } else {
                  //console.error('availableLanguages not in cookie');
              }
              return langList;
          };

          //=======================================================================
          //=======================================================================
          var getLanguageSetting = function () {
              // Is language key and list are in memory already?
              if (language.currentLanguageKey == "" ||
                language.availableLanguages.length == 0) {
                  // Load language key and list from the cookie
                  //availableLanguages not stored via setServerData (we don't want it in the payload)
                  //cookieFactory will hang if reading undefined values (deserializing from JSON needs try/catch)
                  try {
                      var cookieAvailableLanguages = $cookieFactory.getLanguages();
                      var cookieCurrentLanguageKey = $cookieFactory.getServerData("lang");
                  } catch (err) {
                      console.error('get cookieAvailableLanguages err:', err);

                      $cookieFactory.clearLanguages();

                      cookieAvailableLanguages = null;
                  }
              }

              // If there are language key and list in the cookie
              if (cookieCurrentLanguageKey != null && cookieAvailableLanguages != null) {
                  // Save them and pass it back to the previous promise
                  language.currentLanguageKey = cookieCurrentLanguageKey;
                  language.currentLanguageKey = cookieCurrentLanguageKey;
                  language.availableLanguages = cookieAvailableLanguages;
              }
              return language;
          };

          //=======================================================================
          //=======================================================================
          var getLanguageList = function () {
              if (language.availableLanguages.length === 0) {
                  getLanguageSetting();
              }
              return buildLanguageList();
          };

          //=======================================================================
          //=======================================================================
          var getCurrentLanguage = function () {
              return getLanguageSetting().currentLanguageKey;
          };

          var getMenuLanguage = function () {
              if (langList.length === 0) {
                  buildLanguageList();
              }
              language.menuLanguage = _.find(langList, function (lang) {
                  return lang.id === language.currentLanguageKey;
              });
              return language.menuLanguage;
          };

          //=======================================================================
          // main set Language function
          // uses promises to ensure in ordering that the server has had
          // the new language set before the page is reloaded and
          // local/server keys are compared
          //=======================================================================

          var setCurrentLanguage = function (newKey, updateServer) {
              // Set the server via its API
              if (updateServer) {
                  // Update Language On Server
                  return serverAccount.setLanguage(newKey).then(function () {
                    return localLanguageConfig();
                  });
              } else {
                  return localLanguageConfig();
              }

              function localLanguageConfig() {
                  var deferred = $q.defer();

                  $translate.use(newKey).then(function () {

                      // Set local
                      language.currentLanguageKey = newKey;

                      // Set cookie only
                      $cookieFactory.setServerData('lang', newKey);

                      //changes the default locale dynamically
                      //combines with Angular currency filter to affect placement of currency symbol
                      tmhDynamicLocale.set(getAngularLocaleKey(newKey));

                      // Set moment locale
                      moment.locale(getAngularLocaleKey(newKey).substr(0, 2));

                      deferred.resolve(true);
                      $rootScope.$broadcast('language:changed', {lang: newKey});
                  });

                  return deferred.promise;
              }
          };

          var setDynamicLocale = function (key) {
              tmhDynamicLocale.set(getAngularLocaleKey(key));
          };

          var getAngularLocaleKey = function (key) {
              //FIXME (HACK) - server currently returns en_US which is wrong since default english audience is in europe
              //server needs to return correct language/locale combination then delete this
              key = (key === 'en_US') ? 'en_GB' : key;
              //END HACK

              //change into the angular/tmhDynamicLocale-expected format
              //so we can leave individual angular-locale filenames and IDs unedited
              //and just copy new ones from the repo for future language extensions
              return key.replace('_', '-').toLowerCase();
          };

          return {
              buildLanguageList:   buildLanguageList,
              getLanguageSetting:  getLanguageSetting,
              getCurrentLanguage:  getCurrentLanguage,
              setCurrentLanguage:  setCurrentLanguage,
              getMenuLanguage:     getMenuLanguage,
              getLanguageList:     getLanguageList,
              getAngularLocaleKey: getAngularLocaleKey,
              setDynamicLocale:    setDynamicLocale
          }
      }
  ]);
