// connexion pane elements
var connexionPaneElem = document.getElementById("connexion");
var serverUrlElem = document.getElementById("in-server-url");
var baseUrlElem = document.getElementById("in-base-url");
var userEmailElem = document.getElementById("in-user-email");
var userPasswordElem = document.getElementById("in-user-password");
var mustSaveElem = document.getElementById("in-remember-me");
var saveSettings = document.getElementById("save-settings");

// userProfile elements
var profilPaneElem = document.getElementById("profile");
var serverUrlPrElem = document.getElementById("linshare-server-url");
var baseUrlPrElem = document.getElementById("linshare-base-url");
var userEmailPrElem = document.getElementById("linshare-user-email");
var serverVersionPrElem = document.getElementById("linshare-server-version");
var userDisplayNameElem = document.getElementById("user-display-name");
var userDisplayAvatarElem = document.getElementById("user-display-avatar");
var userQuotaElem = document.getElementById("user-quota");
var logOutBtn = document.getElementById("log-out-btn");

// userPreference elements
var messageElem = document.getElementById("message");
var accusedOfSharingElem = document.getElementById("accused-of-sharing");
var noDownloadElem = document.getElementById("no-download");
var secureShareElem = document.getElementById("secure-share");
var savePreferences = document.getElementById("save-prefs");

const render = function (authenticated = false) {
  //check if user is logged and switch beetween profil and connexion pane

  browser.linshareExtAPI.getUserSettings().then((userInfos) => {
    if (userInfos) {
      setProfilInfo(userInfos);
      browser.linshareExtAPI.getUserPrefs().then((userPrefs) => {
        if (userPrefs) setProfilPrefs(userPrefs);
      });
      if (userInfos.USER_PASSWORD || authenticated) {
        connexionPaneElem.classList.remove("show");
        profilPaneElem.classList.add("show");
      } else {
        profilPaneElem.classList.remove("show");
        connexionPaneElem.classList.add("show");
      }
    } else {
      profilPaneElem.classList.remove("show");
      connexionPaneElem.classList.add("show");
    }
  });
};

const saveAccount = async function (e) {
  e.preventDefault();
  const credentials = await browser.linshareExtAPI.saveUserAccount(
    serverUrlElem.value,
    baseUrlElem.value,
    userEmailElem.value,
    userPasswordElem.value,
    mustSaveElem.checked
  );

  if (credentials.success == true) {
    alertify.success(credentials.MESSAGE);
    render(true);
    //connexionPaneElem.classList.remove("show");
    //profilPaneElem.classList.add("show");
  } else {
    alertify.error("ERROR: " + credentials.MESSAGE);
  }
};

const savePrefs = async function (e) {
  e.preventDefault();
  const preferences = await browser.linshareExtAPI.saveUserPrefs(
    messageElem.value,
    accusedOfSharingElem.checked,
    noDownloadElem.checked,
    secureShareElem.checked
  );
  if (preferences.success == true) {
    alertify.success(preferences.message);
  } else {
    alertify.error("ERROR: " + preferences.message);
  }
};

const resetAccount = async function (e) {
  e.preventDefault();
  await browser.linshareExtAPI.resetPrefs();
  render(false);
  //profilPaneElem.classList.remove("show");
  //connexionPaneElem.classList.add("show");
};

function setProfilInfo(userInfos) {
  for (let elem of [serverUrlElem, baseUrlElem, userEmailElem, userPasswordElem, mustSaveElem]) {
    elem.value = null;
  }

  if (userInfos.SERVER_URL && userInfos.SERVER_URL != "undefined") {
    // document.getElementById('v1').style.display = "block";
    serverUrlPrElem.textContent = userInfos.SERVER_URL;
    serverUrlElem.value = userInfos.SERVER_URL;
  }

  if (userInfos.BASE_URL && userInfos.BASE_URL != "undefined") {
    baseUrlPrElem.textContent = userInfos.BASE_URL;
    baseUrlElem.value = userInfos.BASE_URL;
  }

  if (userInfos.USER_EMAIL && userInfos.USER_EMAIL != "undefined") {
    userEmailPrElem.textContent = userInfos.USER_EMAIL;
    userEmailElem.value = userInfos.USER_EMAIL;
  }

  if (userInfos.API_VERSION && userInfos.API_VERSION != "undefined") {
    serverVersionPrElem.textContent = userInfos.API_VERSION;
  }

  if (userInfos.MUST_SAVE) {
    mustSaveElem.checked = userInfos.MUST_SAVE;
  }

  if (userInfos.USER_PASSWORD) {
    userPasswordElem.value = userInfos.USER_PASSWORD;
  }

  if (userInfos.USER_DISPLAYNAME) {
    userDisplayAvatarElem.textContent = userInfos.USER_DISPLAYNAME.split(" ")
      .map((el) => el[0])
      .join("")
      .toUpperCase();
    userDisplayNameElem.textContent = userInfos.USER_DISPLAYNAME;
  }
  if (userInfos.USER_QUOTA) {
    userQuotaElem.style.width = `${userInfos.USER_QUOTA}%`;
    userQuotaElem.setAttribute("aria-valuenow", userInfos.USER_QUOTA);
    userQuotaElem.textContent = `${userInfos.USER_QUOTA}%`;
  }
}

function setProfilPrefs(userPrefs) {
  displayPref(messageElem, userPrefs.message);
  displayPref(accusedOfSharingElem, userPrefs.accusedOfSharing);
  displayPref(noDownloadElem, userPrefs.noDownload);
  displayPref(secureShareElem, userPrefs.secureShare);
}

function displayPref(prefElem, value) {
  if (value == null || value == undefined) {
    prefElem.parentElement.classList.add("hide");
    return;
  }
  if (prefElem.classList.contains("hide")) prefElem.classList.remove("hide");
  if (typeof value == "boolean") {
    prefElem.checked = value;
  } else {
    prefElem.value = value;
  }
}

saveSettings.onclick = saveAccount;

savePreferences.onclick = savePrefs;

logOutBtn.onclick = resetAccount;

document.addEventListener("load", render());
