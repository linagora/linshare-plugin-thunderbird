var serverUrlElem = document.getElementById('serverUrl');
var userEmailElem = document.getElementById('userEmail');
var userPasswordElem = document.getElementById('userPassword');
var mustSaveElem = document.getElementById('mustSave');
var messageElem = document.getElementById('message');
var accusedOfSharingElem = document.getElementById('accusedOfSharing');
var noDownloadElem = document.getElementById('noDownload');
var secureShareElem = document.getElementById('secureShare');
var savePreferences = document.getElementById("savePreferences")
var saveSattings = document.getElementById("saveSettings")

init()

function init() {
  browser.linshare.getUserSettings().then(userInfos => {
    if (userInfos) {
      setProfilInfo(userInfos);
      browser.linshare.getUserPrefs().then(userPrefs => {
        if (userPrefs) setProfilPrefs(userPrefs);
      });
    }
  })
}

saveSattings.onclick = function (e) {
  e.preventDefault();
  browser.linshare.saveUserAccount(serverUrlElem.value, userEmailElem.value, userPasswordElem.value, mustSaveElem.checked).then(credentials => {
    if (credentials.success == true) {
      alertify.success(credentials.MESSAGE);
    } else {
      alertify.error('ERROR: ' + credentials.MESSAGE);
    }
  });
}

savePreferences.onclick = function (e) {
  e.preventDefault();
  browser.linshare.saveUserPrefs(messageElem.value, accusedOfSharingElem.checked, noDownloadElem.checked, secureShareElem.checked).then(preferences => {
    if (preferences.success == true) {
      alertify.success(preferences.MESSAGE);
    } else {
      alertify.error('ERROR: ' + preferences.MESSAGE);
    }
  });
}

function setProfilInfo(userInfos) {
  if (userInfos.SERVER_URL && userInfos.SERVER_URL != 'undefined') {
    document.getElementById('v1').style.display = "block";
    serverUrlElem.value = userInfos.SERVER_URL;
  }
  if (userInfos.USER_EMAIL && userInfos.USER_EMAIL != 'undefined') {
    userEmailElem.value = userInfos.USER_EMAIL;
  }
  if (userInfos.MUST_SAVE) {
    mustSaveElem.checked = userInfos.MUST_SAVE;
  }
  if (userInfos.USER_PASSWORD) {
    userPasswordElem.value = userInfos.USER_PASSWORD;
  }
  if (userInfos.version && userInfos.version >= 2) {
    document.getElementById('v2').style.display = "block";
  }
}

function setProfilPrefs(userPrefs) {
  let accusedOfSharing = document.getElementById('accusedOfSharing');
  let noDownload = document.getElementById('noDownload');

  messageElem.value = userPrefs.message;
  accusedOfSharingElem.checked = userPrefs.accusedOfSharing;
  noDownloadElem.checked = userPrefs.noDownload;
  secureShareElem.checked = userPrefs.secureShare;
  if (userPrefs.accusedOfSharingOverride) {
    accusedOfSharing.setAttribute("disabled", "");
  }
  if (userPrefs.noDownloadOverride) {
    noDownload.setAttribute("disabled", "");
  }
}


