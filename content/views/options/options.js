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

const render = function (authenticated = false) {
  console.log("Rendu de la page d'options...");

  // Utilisation du stockage local au lieu de l'API expérimentale
  browser.storage.local.get(['linshareUserInfos', 'linshareUserPrefs']).then((result) => {
    console.log("Données récupérées:", result);
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
      message: "Votre document a été partagé via LinShare",
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
    console.error("Erreur lors du chargement des paramètres:", error);
    profilPaneElem.classList.remove("show");
    connexionPaneElem.classList.add("show");
  });
};

const saveAccount = async function (e) {
  e.preventDefault();

  const authType = authTypeElem ? authTypeElem.value : "basic";

  // Validation des champs
  if (!serverUrlElem.value || !userEmailElem.value) {
    alertify.error("ERREUR: L'URL du serveur et l'email sont obligatoires");
    return;
  }

  if (authType === "basic" && !userPasswordElem.value) {
    alertify.error("ERREUR: Le mot de passe est obligatoire pour l'authentification Basic");
    return;
  }

  if (authType === "jwt" && !jwtTokenElem.value) {
    alertify.error("ERREUR: Le token JWT est obligatoire pour l'authentification JWT");
    return;
  }

  const userInfos = {
    SERVER_URL: serverUrlElem.value.replace(/\/$/, ""),
    BASE_URL: baseUrlElem.value.replace(/^\//, "") || "linshare",
    USER_EMAIL: userEmailElem.value,
    USER_PASSWORD: userPasswordElem.value,
    JWT_TOKEN: jwtTokenElem.value,
    AUTH_TYPE: authType,
    DISPLAY_NAME: userEmailElem.value,
    MUST_SAVE: mustSaveElem.checked,
    API_VERSION: "v5"
  };

  // Test de connexion à LinShare
  try {
    alertify.message("Test de connexion à LinShare...");

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
      await browser.storage.local.set({ linshareUserInfos: userInfos });
      alertify.success("Connexion réussie - Paramètres sauvegardés");
      render(true);
    } else {
      alertify.error("ERREUR: Impossible de se connecter à LinShare - Vérifiez vos identifiants");
    }
  } catch (error) {
    console.error("Erreur lors du test de connexion:", error);
    alertify.error("ERREUR: Impossible de se connecter au serveur LinShare");
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
    alertify.success("Préférences sauvegardées avec succès");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des préférences:", error);
    alertify.error("ERREUR: Impossible de sauvegarder les préférences");
  }
};

const resetAccount = async function (e) {
  e.preventDefault();

  try {
    await browser.storage.local.clear();
    alertify.success("Paramètres réinitialisés");
    render(false);
  } catch (error) {
    console.error("Erreur lors de la réinitialisation:", error);
    alertify.error("ERREUR: Impossible de réinitialiser les paramètres");
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
  document.addEventListener("DOMContentLoaded", render);
} else {
  render();
}

// Debug: vérifier que tous les éléments sont trouvés
console.log("Éléments DOM trouvés:");
console.log("connexionPaneElem:", !!connexionPaneElem);
console.log("serverUrlElem:", !!serverUrlElem);
console.log("profilPaneElem:", !!profilPaneElem);
console.log("saveSettings:", !!saveSettings);

// Ajouter un gestionnaire d'erreur global pour la page d'options
window.addEventListener('error', (event) => {
  console.error('Erreur dans la page d\'options:', event.error);
});
