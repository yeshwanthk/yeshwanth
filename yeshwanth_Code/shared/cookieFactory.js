'use strict';

angular.module('appVPN')

    //======================================================================
    // Handle all cookie operations
    //======================================================================
  .factory('$cookieFactory', ['$window', '$rootScope', 'serverCore', 'ipCookie', 'CONST',
      function ($window, $rootScope, serverCore, ipCookie, CONST) {

          //----------------------------------------------------------------------
          function getCookie(key) {
              // Add try catch will fix the problem
              try {
                  if (ipCookie(key) !== undefined) {
                      return ipCookie(key);
                  }
              } catch (e) {
                  // this is ok
              }

              return null;
          }

          function setCookie(key, value) {
              // Add try catch will fix the problem
              try {
                  ipCookie(key, value, {expires: CONST.COOKIE_EXPIRY});
              } catch (e) {
                  // this is ok
              }
          }

          function delCookie(key) {
              ipCookie.remove(key);
              // doesn't hurt if the cookie is not in the serverCore list
              serverCore.removeServerData(key);
          }

          //----------------------------------------------------------------------
          function getServerData(key) {
              if ($rootScope.needsCookies) {
                  return getCookie(key) || serverCore.getServerData(key);
              } else {
                  return serverCore.getServerData(key);
              }
          }

          function setServerData(key, value) {

              if ($rootScope.needsCookies) {
                  setCookie(key, value);
              }
              else {
                  // do not actually use cookie store - everything is stored in memory
                  // delete in case it's still there from login (when needsCookies = true)
                  ipCookie.remove(key);
              }
              // in the serverCore
              serverCore.setServerData(key, value);
          }

          //----------------------------------------------------------------------


          //----------------------------------------------------------------------
          // Save the login related data to cookie and payload and then redirect
          //----------------------------------------------------------------------
          function clearAll() {
              delCookie('superuser_profile');
              delCookie('serviceId');
              delCookie('providerId');
              delCookie('userId');
              delCookie('tenantId');
              delCookie('isAdmin');
          }

          function removeServiceId() {
            delCookie('serviceId');
          }

          function removeSessionId() {
            delCookie('sessionId');
          }


        //----------------------------------------------------------------------
          function saveLoginCookie(loginCookie) {

              // Cookie superuser_profile's structure =>
              // {"userId":"vsingla@cisco.com","providerId":"HT","supportLang":["en_US","hr_HR"],"lang":"en_US"}
              var cookieData = getCookie('superuser_profile');
              //console.log('superuser_profile:', cookieData);
              if (cookieData) {
                  // No longer need this
                  delCookie('superuser_profile');
              }

              // If we don't get the cookie, then we check the response.
              if (cookieData == null) {
                  // We do have the server response, right?
                  if (loginCookie != null) {
                      // Yes, then use server response
                      // No, then fall back to check the server response
                      if (loginCookie.providerId == null ||
                        loginCookie.userId == null ||
                        loginCookie.lang == null ||
                        loginCookie.supportLang == null) {
                          console.error('Incomplete response parameters from the server: providerId, userId, lang, and availableLanguages should be in cookie or response.');

                          // We can not find it in cookie or response, then just quit
                          return false;
                      } else {
                          cookieData = {};
                          cookieData.providerId = loginCookie.providerId;
                          cookieData.userId = loginCookie.userId;
                          cookieData.lang = loginCookie.lang;
                          cookieData.supportLang = loginCookie.supportLang;
                      }

                      //console.log('saveLoginCookie response:', response, ', cookieData:', cookieData);
                  } else {
                      console.error('Server does not provide all necessary cookies such as providerId, userId, lang, and availableLanguages(server should provide it in cookie or response).');
                      return;
                  }
              }

              //alert("Provier ID = "+cookieData.providerId + ", User ID = "+cookieData.userId + ", Language =
              // "+cookieData.lang + ", Language List = "+cookieData.supportLang);
              //console.log('loginCookie:', loginCookie);

              // After the super use logs in, we will only have the following data in response
              // serviceId and tenantId won't be available until the user select one from the drop down menu
              setServerData('providerId', cookieData.providerId);
              setServerData('userId', cookieData.userId);
              setServerData('lang', cookieData.lang);

              // For regular user login, they will have these two additional ID, but for the super user login,
              // they won't have the following ids(the superuser need to pick a tenant from the dropdown in order to
              // have the following ids)
              if (cookieData.tenantId != null) {
                  setServerData('tenantId', cookieData.tenantId);
              }
              if (!!cookieData.serviceId && !_.isEmpty(cookieData.serviceId)) {
                  setServerData('serviceId', cookieData.serviceId);
              }

              // Don't save available languages in the payload, so use cookie store directly
              setCookie('availableLanguages', cookieData.supportLang);

              return true;
          }

          //----------------------------------------------------------------------
          function isAdmin(val) {
              if (val !== undefined) {
                  setServerData('isAdmin', val);
                  if ($rootScope.needsCookies) {
                      setCookie('isAdmin', val)
                  }

                  $rootScope.isAdmin = val;

                  //console.log('set isAdmin:', val ,
                  //  ", getServerData('isAdmin'):", getServerData('isAdmin'),
                  //  ", $rootScope.needsCookies:", $rootScope.needsCookies,
                  //  ", getCookie('isAdmin'):", getCookie('isAdmin')
                  //);
                  return val;
              } else {
                  val = (  !!getServerData('isAdmin') ||
                  ( $rootScope.needsCookies && !!getCookie('isAdmin') )
                  );

                  //console.log("get isAdmin:", val,
                  //  ", getServerData('isAdmin'):", getServerData('isAdmin'),
                  //  ", $rootScope.needsCookies:", $rootScope.needsCookies,
                  //  ", getCookie('isAdmin'):", getCookie('isAdmin'));
                  return val;
              }
          }

          function adminLogin(loginCookie) {
              //clear out all cookies before adding new ones
              clearAll();

              // Convert the backend cookie to our format and save them
              saveLoginCookie(loginCookie);

              // superUser has successfully logged in, so we need to update the cookie
              if ($rootScope.needsCookies) {
                  isAdmin(true);
              }
          }

          function logout() {
              // force full page reload
              if (isAdmin()) {
                  //console.log('$cookieFactory Admin Logout!!!');
                  $window.location.href = '/adminLogout';
              } else {
                  //console.log('$cookieFactory SSO User Logout!!!');
                  $window.location.href = '/logout';
              }

              removeSessionId();
              clearAll();
              $rootScope.isAdmin = false;
          }


          //----------------------------------------------------------------------
          function clearLanguages() {
              delCookie('availableLanguages');
              delCookie('lang');
          }

          function saveLanguages(supportLang) {
              setCookie('availableLanguages', supportLang || null);
          }

          function getLanguages() {
              return getCookie('availableLanguages');
          }

          //----------------------------------------------------------------------
          function isMissingRequired() {
              return (!getServerData('userId') || !getServerData('tenantId') || !getServerData('providerId') || !getServerData('lang') || !getCookie('availableLanguages'));
          }

          serverCore.init(
            getCookie('serviceId'),
            getCookie('providerId'),
            getCookie('userId'),
            getCookie('tenantId'),
            logout.bind(this)
          );

          return {
              clearAll:        clearAll,
              removeServiceId: removeServiceId,
              removeSessionId: removeSessionId,

              saveLoginCookie: saveLoginCookie,
              isAdmin:         isAdmin,
              adminLogin:      adminLogin,
              logout:          logout,

              saveLanguages:  saveLanguages,
              getLanguages:   getLanguages,
              clearLanguages: clearLanguages,

              isMissingRequired: isMissingRequired,

              getServerData: getServerData,
              setServerData: setServerData
          };
      }
  ]);
