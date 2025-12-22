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

var authTypeElem = document.getElementById("in-auth-type");
var jwtTokenElem = document.getElementById("in-jwt-token");
var passwordGroup = document.getElementById("password-group");
var jwtGroup = document.getElementById("jwt-group");

// Handle auth type change
if (authTypeElem) {
  authTypeElem.addEventListener("change", function () {
    if (this.value === "jwt") {
      passwordGroup.style.display = "none";
      jwtGroup.style.display = "flex";
    } else {
      passwordGroup.style.display = "flex";
      jwtGroup.style.display = "none";
    }
  });
}

// i18n localization function
function localizeUI() {
  console.log("Localizing UI...");
  document.querySelectorAll("[data-i18n]").forEach(elem => {
    const key = elem.getAttribute("data-i18n");
    const msg = browser.i18n.getMessage(key);
    if (msg) {
      if (elem.tagName === "TITLE") {
        document.title = msg;
      } else {
        elem.textContent = msg;
      }
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(elem => {
    const key = elem.getAttribute("data-i18n-placeholder");
    const msg = browser.i18n.getMessage(key);
    if (msg) elem.placeholder = msg;
  });
}

const render = function (authenticated = false) {
  console.log("Rendering options page...");
  localizeUI();

  // Utilisation du stockage local au lieu de l'API expérimentale
  browser.storage.local.get(['linshareUserInfos', 'linshareUserPrefs']).then((result) => {
    console.log("Data retrieved:", result);
    const userInfos = result.linshareUserInfos || {
      SERVER_URL: "",
      BASE_URL: "",
      USER_EMAIL: "",
      DISPLAY_NAME: "",
      MUST_SAVE: false,
      AUTH_TYPE: "basic",
      JWT_TOKEN: ""
    };
    const userPrefs = result.linshareUserPrefs || {
      message: browser.i18n.getMessage("defaultShareMessage"),
      accusedOfSharing: false,
      noDownload: false,
      secureShare: false
    };
    setProfilInfo(userInfos);
    setProfilPrefs(userPrefs);

    if (userInfos.USER_EMAIL && userInfos.SERVER_URL) {
      connexionPaneElem.classList.remove("show");
      profilPaneElem.classList.add("show");
    } else {
      profilPaneElem.classList.remove("show");
      connexionPaneElem.classList.add("show");
    }
  }).catch((error) => {
    console.error("Error loading settings:", error);
    profilPaneElem.classList.remove("show");
    connexionPaneElem.classList.add("show");
  });
};

const saveAccount = async function (e) {
  e.preventDefault();

  const authType = authTypeElem ? authTypeElem.value : "basic";

  // Validation des champs
  if (!serverUrlElem.value || !userEmailElem.value) {
    alertify.error(browser.i18n.getMessage("errUrlEmailRequired"));
    return;
  }

  if (authType === "basic" && !userPasswordElem.value) {
    alertify.error(browser.i18n.getMessage("errPasswordRequired"));
    return;
  }

  if (authType === "jwt" && !jwtTokenElem.value) {
    alertify.error(browser.i18n.getMessage("errJwtRequired"));
    return;
  }

  const userInfos = {
    SERVER_URL: serverUrlElem.value.replace(/\/$/, ""),
    BASE_URL: baseUrlElem.value.replace(/^\//, "") || "linshare",
    USER_EMAIL: userEmailElem.value,
    USER_PASSWORD: userPasswordElem.value, // This will be passed to Experiment API
    JWT_TOKEN: jwtTokenElem.value,
    AUTH_TYPE: authType,
    DISPLAY_NAME: userEmailElem.value,
    MUST_SAVE: mustSaveElem.checked,
    API_VERSION: "v5"
  };

  // Test de connexion à LinShare
  try {
    alertify.message(browser.i18n.getMessage("connexionTesting"));

    const testUrl = `${userInfos.SERVER_URL}/${userInfos.BASE_URL}/webservice/rest/user/v5/authentication/authorized`;

    let headers = {
      'Accept': 'application/json'
    };

    if (authType === "jwt") {
      headers['Authorization'] = 'Bearer ' + userInfos.JWT_TOKEN;
    } else {
      headers['Authorization'] = 'Basic ' + btoa(userInfos.USER_EMAIL + ':' + userInfos.USER_PASSWORD);
    }

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      // Use Experiment API to save securely
      if (browser.linshareExtAPI && browser.linshareExtAPI.saveUserAccount) {
        await browser.linshareExtAPI.saveUserAccount(
          userInfos.SERVER_URL,
          userInfos.BASE_URL,
          userInfos.USER_EMAIL,
          userInfos.USER_PASSWORD,
          userInfos.MUST_SAVE,
          userInfos.AUTH_TYPE,
          userInfos.JWT_TOKEN
        );
      }

      // Save other non-sensitive info to local storage for UI persistence
      const publicInfos = { ...userInfos };
      delete publicInfos.USER_PASSWORD; // CRITICAL: Never save password in plain text

      await browser.storage.local.set({ linshareUserInfos: publicInfos });
      alertify.success(browser.i18n.getMessage("connexionSuccess"));
      render(true);
    } else {
      alertify.error(browser.i18n.getMessage("errConnexionFailed"));
    }
  } catch (error) {
    console.error("Connection test error:", error);
    alertify.error(browser.i18n.getMessage("errServerUnreachable"));
  }
};

const savePrefs = async function (e) {
  e.preventDefault();

  const userPrefs = {
    message: messageElem.value,
    accusedOfSharing: accusedOfSharingElem.checked,
    noDownload: noDownloadElem.checked,
    secureShare: secureShareElem.checked
  };

  try {
    await browser.storage.local.set({ linshareUserPrefs: userPrefs });
    alertify.success(browser.i18n.getMessage("prefsSavedSuccess"));
  } catch (error) {
    console.error("Error saving preferences:", error);
    alertify.error(browser.i18n.getMessage("errPrefsSaveFailed"));
  }
};

const resetAccount = async function (e) {
  e.preventDefault();

  try {
    await browser.storage.local.clear();
    alertify.success(browser.i18n.getMessage("settingsResetSuccess"));
    render(false);
  } catch (error) {
    console.error("Reset error:", error);
    alertify.error(browser.i18n.getMessage("errSettingsResetFailed"));
  }
};

function setProfilInfo(userInfos) {
  // Réinitialiser les champs
  if (serverUrlElem) serverUrlElem.value = "";
  if (baseUrlElem) baseUrlElem.value = "";
  if (userEmailElem) userEmailElem.value = "";
  if (userPasswordElem) userPasswordElem.value = "";
  if (jwtTokenElem) jwtTokenElem.value = "";
  if (mustSaveElem) mustSaveElem.checked = false;

  if (userInfos.AUTH_TYPE) {
    if (authTypeElem) {
      authTypeElem.value = userInfos.AUTH_TYPE;
      // Trigger change event to update UI visibility
      authTypeElem.dispatchEvent(new Event('change'));
    }
  }

  if (userInfos.JWT_TOKEN && jwtTokenElem) {
    jwtTokenElem.value = userInfos.JWT_TOKEN;
  }

  if (userInfos.USER_PASSWORD && userPasswordElem) {
    userPasswordElem.value = userInfos.USER_PASSWORD;
  }

  if (userInfos.SERVER_URL && userInfos.SERVER_URL !== "undefined") {
    serverUrlPrElem.textContent = userInfos.SERVER_URL;
    serverUrlElem.value = userInfos.SERVER_URL;
  }

  if (userInfos.BASE_URL && userInfos.BASE_URL !== "undefined") {
    baseUrlPrElem.textContent = "/" + userInfos.BASE_URL;
    baseUrlElem.value = userInfos.BASE_URL;
  }

  if (userInfos.USER_EMAIL && userInfos.USER_EMAIL !== "undefined") {
    userEmailPrElem.textContent = userInfos.USER_EMAIL;
    userEmailElem.value = userInfos.USER_EMAIL;

    // Afficher les initiales dans l'avatar
    const initials = userInfos.USER_EMAIL.substring(0, 2).toUpperCase();
    userDisplayAvatarElem.textContent = initials;
    userDisplayNameElem.textContent = userInfos.DISPLAY_NAME || userInfos.USER_EMAIL;
  }

  if (userInfos.API_VERSION && userInfos.API_VERSION !== "undefined") {
    serverVersionPrElem.textContent = userInfos.API_VERSION;
  } else {
    serverVersionPrElem.textContent = "v5";
  }

  if (userInfos.MUST_SAVE) {
    mustSaveElem.checked = userInfos.MUST_SAVE;
  }

  // Simuler un quota utilisé
  userQuotaElem.style.width = "25%";
  userQuotaElem.setAttribute("aria-valuenow", "25");
  userQuotaElem.textContent = "25%";
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

// S'assurer que le DOM est chargé avant d'initialiser
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    localizeUI();
    render();
  });
} else {
  localizeUI();
  render();
}

// Ajouter un gestionnaire d'erreur global pour la page d'options
window.addEventListener('error', (event) => {
  console.error('Error in options page:', event.error);
});
