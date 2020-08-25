var EXPORTED_SYMBOLS = ["LinshareUtils"];

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { LinshareAPI } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareAPI.jsm"));
var infos = {}

var LinshareUtils = {
  setInfos(infos) {
    this.infos = infos
  },
  getInfos() {
    return this.infos
  },
  getCurrentComposeWindow() {
    return Services.wm.getMostRecentWindow("msgcompose");
  },
  async setUserPassword(SERVEUR_URL, USER_EMAIL, userPassword, check) {
    let logins = Services.logins.findLogins(SERVEUR_URL, null, SERVEUR_URL);
    if (logins != undefined && logins.length > 0) {
      let login = logins.filter(l => l.username == USER_EMAIL)[0]
      if (login && login.password && login.password == userPassword) {
        return { 'MESSAGE': 'Your account was succesfuly checked, your credentials are saved ', 'success': true };
      } else {
        if (check.ok) {
          let newLogin = this.createLogin(SERVEUR_URL, USER_EMAIL, userPassword)
          Services.logins.modifyLogin(login, newLogin)
          return { 'MESSAGE': 'Your account was succesfuly checked, your credentials are updated', 'success': true };
        } else {
          return { 'MESSAGE': 'Something went wrong, please check your credentials', 'success': false };
        }
      }
    }
    if (check.ok) {
      let loginInfo = this.createLogin(SERVEUR_URL, USER_EMAIL, userPassword)
      Services.logins.addLogin(loginInfo);
      return { 'MESSAGE': 'Your account was succesfuly checked, your credentials are updated', 'success': true };
    } else {
      return { 'MESSAGE': 'Something went wrong, please check your credentials', 'success': false };
    }
  },
  createLogin(SERVEUR_URL, USER_EMAIL, userPassword) {
    var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
      Components.interfaces.nsILoginInfo,
      "init");
    var loginInfo = new nsLoginInfo(SERVEUR_URL, null, SERVEUR_URL, USER_EMAIL, userPassword, "", "");
    return loginInfo;
  },
  getUserPassword(SERVER_URL, USER_EMAIL) {
    let logins = Services.logins.findLogins(SERVER_URL, null, SERVER_URL);
    if (logins && logins.length > 0) {
      let log = logins.filter(login => login.username == USER_EMAIL);
      if (log) {
        return log[0].password
      }
    }
    return false;
  },
  prompt(type, title, msg) {
    Services.prompt[type](null, title, msg)
  },
  checkPrefExist(name) {
    if (Preferences.get(name)) {
      return false;
    }
    return true;
  },
  isProfilsPrefsV4(SERVER_URL, USER_EMAIL, isSaved) {
    let response = LinshareAPI.isPrefsEnable(SERVER_URL, USER_EMAIL);

    response.then((prefs) => {
      if (prefs.accusedOfSharing && prefs.accusedOfSharingOverride && (checkPrefExist("ACCUSED_OF_SHARING_OVERRIDE"))) {
        Preferences.set("linshare.ACCUSED_OF_SHARING", prefs.accusedOfSharing);
        Preferences.set("linshare.ACCUSED_OF_SHARING_OVERRIDE", prefs.accusedOfSharingOverride);
        isSaved = { ...isSaved, 'ACCUSED_OF_SHARING': prefs.accusedOfSharing, "ACCUSED_OF_SHARING_OVERRIDE": prefs.accusedOfSharingOverride };
      }

      if (prefs.noDownload && prefs.noDownloadOverride && (checkPrefExist("NO_DOWNLOAD_OVERRIDE"))) {
        Preferences.set("linshare.NO_DOWNLOAD", prefs.noDownload);
        Preferences.set("linshare.NO_DOWNLOAD_OVERRIDE", prefs.noDownloadOverride);
        isSaved = { ...isSaved, 'NO_DOWNLOAD': noDownload, "NO_DOWNLOAD_OVERRIDE": prefs.noDownloadOverride };
      }

      if (prefs.secureShare && (checkPrefExist("SECURE_SHARE"))) {
        Preferences.set("linshare.SECURE_SHARE", prefs.secureShare);
        isSaved = { ...isSaved, 'SECURE_SHARE': prefs.secureShare };
      }
      return isSaved
    });
    return false
  },
  isProfilsPrefsV2(isSaved) {
    let accusedOfSharing = Preferences.get("linshare.ACCUSED_OF_SHARING");
    if (accusedOfSharing) {
      isSaved = { ...isSaved, 'ACCUSED_OF_SHARING': accusedOfSharing };
    } else {
      isSaved = { ...isSaved, 'ACCUSED_OF_SHARING': false };
    }

    let noDownload = Preferences.get("linshare.NO_DOWNLOAD");
    if (noDownload) {
      isSaved = { ...isSaved, 'NO_DOWNLOAD': noDownload };
    } else {
      isSaved = { ...isSaved, 'NO_DOWNLOAD': false };
    }

    let secureShare = Preferences.get("linshare.SECURE_SHARE");
    if (noDownload) {
      isSaved = { ...isSaved, 'SECURE_SHARE': secureShare };
    } else {
      isSaved = { ...isSaved, 'SECURE_SHARE': false };
    }
    return isSaved;
  },
  isProfilPrefs(API_VERSION) {
    let message = Preferences.get("linshare.MESSAGE");
    let isSaved = message ? { 'MESSAGE': message } : { 'message': 'Un deuxième courriel vous sera adressé ultérieurement pour télécharger vos fichiers depuis l\'application de partage LinShare.' };

    if (API_VERSION >= 4) {
      return this.isProfilsPrefsV4(isSaved);
    } else {
      return this.isProfilsPrefsV2(isSaved);
    }
  },
  async setUserPreferences(API_VERSION, message, accusedOfSharing, noDownload, secureShare) {
    if (message.length > 0) {
      Preferences.set("linshare.MESSAGE", message);
    } else {
      return { 'MESSAGE': 'message empty', 'success': false }
    }

    if (API_VERSION >= 4 && Preferences.get("linshare.ACCUSED_OF_SHARING_OVERRIDE")) {
      Preferences.set("linshare.ACCUSED_OF_SHARING", accusedOfSharing);
    } else if (API_VERSION < 4) {
      Preferences.set("linshare.ACCUSED_OF_SHARING", accusedOfSharing);
    }
    if (API_VERSION >= 4 && Preferences.get("linshare.NO_DOWNLOAD_OVERRIDE")) {
      Preferences.set("linshare.NO_DOWNLOAD", noDownload);
    } else if (API_VERSION < 4) {
      Preferences.set("linshare.NO_DOWNLOAD", noDownload);
    }
    Preferences.set("linshare.SECURE_SHARE", secureShare);
    return { 'MESSAGE': 'saved', 'success': true };
  }
}
console.log('Loading LinshareUtils module');