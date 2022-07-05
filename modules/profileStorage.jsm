var EXPORTED_SYMBOLS = ["userProfile"];
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { TBUIHandlers } = ChromeUtils.import(extension.rootURI.resolve("modules/TBUIHandlers.jsm"));

const userProfile = {
  availablePrefs: {
    v5: ["message", "accusedOfSharing", "noDownload", "secureShare"],
    v4: ["message", "accusedOfSharing", "noDownload", "secureShare"],
    v2: ["message", "accusedOfSharing", "noDownload", "secureShare"],
    v1: ["message"],
  },
  get userPrefs() {
    let prefs = {};
    for (let pref of this.availablePrefs[this.apiVersion]) {
      prefs[pref] = this[pref];
    }
    return prefs;
  },
  set userPrefs(prefs) {
    for (let pref of this.availablePrefs[this.apiVersion]) {
      if (pref == "message" && !prefs[pref]) throw new Error("Message field cannot be empty");
      if (prefs[pref] != null && prefs[pref] != undefined) {
        this[pref] = prefs[pref];
      }
    }
  },

  get connexionInfos() {
    if (!this.serverUrl) throw new Error("Server URL cannot be empty");
    return {
      SERVER_URL: this.serverUrl,
      USER_EMAIL: this.userEmail,
      API_VERSION: this.apiVersion,
      BASE_URL: this.baseUrl,
    };
  },
  get allInfos() {
    // used for userinfo pannel
    if (!this.serverUrl) return new Error("Server URL cannot be empty");
    return {
      ...this.connexionInfos,
      USER_DISPLAYNAME: this.displayName,
      USER_QUOTA: this.userQuota,
    };
  },
  get serverUrl() {
    return Preferences.get("linshare.SERVER_URL") || null;
  },
  set serverUrl(url) {
    Preferences.set("linshare.SERVER_URL", url);
  },
  get baseUrl() {
    return Preferences.get("linshare.BASE_URL") || "/linshare";
  },
  set baseUrl(url) {
    Preferences.set("linshare.BASE_URL", url);
  },
  get userEmail() {
    return Preferences.get("linshare.USER_EMAIL") || null;
  },
  set userEmail(email) {
    Preferences.set("linshare.USER_EMAIL", email);
  },
  get apiVersion() {
    return Preferences.get("linshare.API_VERSION") || "v5";
  },
  set apiVersion(version) {
    Preferences.set("linshare.API_VERSION", version);
  },
  get mustSave() {
    return Preferences.get("linshare.MUST_SAVE") || false;
  },
  set mustSave(save) {
    Preferences.set("linshare.MUST_SAVE", save);
  },
  get userDisplayName() {
    return Preferences.get("linshare.USER_DISPLAYNAME") || "";
  },
  set userDisplayName(displayName) {
    Preferences.set("linshare.USER_DISPLAYNAME", displayName);
  },
  get userQuota() {
    return Preferences.get("linshare.USER_QUOTA") || null;
  },
  set userQuota(quota) {
    Preferences.set("linshare.USER_QUOTA", quota);
  },
  get message() {
    return Preferences.get(
      "linshare.MESSAGE",
      "Un premier courriel vous a été adressé précédemment pour télécharger vos fichiers depuis l'application de partage LinShare."
    );
  },
  set message(message) {
    Preferences.set("linshare.MESSAGE", message);
  },
  get accusedOfSharing() {
    return Preferences.get("linshare.ACCUSED_OF_SHARING", true);
  },
  set accusedOfSharing(val) {
    Preferences.set("linshare.ACCUSED_OF_SHARING", val);
  },
  get noDownload() {
    return Preferences.get("linshare.NO_DOWNLOAD", true);
  },
  set noDownload(val) {
    Preferences.set("linshare.NO_DOWNLOAD", val);
  },
  get secureShare() {
    return Preferences.get("linshare.SECURE_SHARE", true);
  },
  set secureShare(val) {
    Preferences.set("linshare.SECURE_SHARE", val);
  },
  getUserPassword() {
    try{
      let tocken = this.getUserTocken();
      let passwd = this.getUserPasswordFromTBVault();
      let composerPass = this.getPassFromComposer();
      let userPasswd = [tocken, passwd, composerPass].filter((pass) => pass)[0];
      if (userPasswd) return userPasswd;
      throw new Error('No password found for user')
    } catch (error) {
      throw error
    }
  },
  getUserTocken() {
    let tocken = Services.cookies.cookieExists(userProfile.serverUrl, "/", "JSESSIONID", {});
    if (tocken) return tocken;
  },
  getPassFromComposer() {
    if (
      TBUIHandlers.getCurrentComposeWindow()?.credentials &&
      TBUIHandlers.getCurrentComposeWindow()?.credentials.hasPass
    ) {
      return TBUIHandlers.getCurrentComposeWindow().credentials.pass;
    }
  },
  getUserPasswordFromTBVault() {
    let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
    if (logins && logins.length > 0) {
      let log = logins.filter((login) => login.username == this.userEmail);
      if (log && log.length > 0) {
        return log[0].password;
      }
    }
    return false;
  },
  async saveUserPasswordInTBVault(userPassword, check) {
    let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
    if (logins != undefined && logins.length > 0) {
      let login = logins.filter((l) => l.username == this.userEmail)[0];
      if (login && login.password && login.password == userPassword) {
        return {
          MESSAGE: "Your account was succesfuly checked, your credentials are saved ",
          success: true,
        };
      } else if (login) {
        if (check.ok) {
          let newLogin = this.createLogin(userPassword);
          Services.logins.modifyLogin(login, newLogin);
          return {
            MESSAGE: "Your account was succesfuly checked, your credentials are updated",
            success: true,
          };
        } else {
          return {
            MESSAGE: "Something went wrong, please check your credentials",
            success: false,
          };
        }
      }
    }
    if (check.ok) {
      let loginInfo = this.createLogin(userPassword);
      Services.logins.addLogin(loginInfo);
      return {
        MESSAGE: "Your account was succesfuly checked, your credentials are updated",
        success: true,
      };
    } else {
      return {
        MESSAGE: "Something went wrong, please check your credentials",
        success: false,
      };
    }
  },
  removeUserPasswordFromTBVault() {
    let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
    if (logins && logins.length > 0) {
      let log = logins.filter((login) => login.username == this.userEmail);
      if (log && log.length > 0) {
        Services.logins.removeLogin(log[0]);
      }
    }
  },
  createLogin(userPassword) {
    var nsLoginInfo = new Components.Constructor(
      "@mozilla.org/login-manager/loginInfo;1",
      Components.interfaces.nsILoginInfo,
      "init"
    );
    var loginInfo = new nsLoginInfo(
      this.serverUrl,
      null,
      this.serverUrl,
      this.userEmail,
      userPassword,
      "",
      ""
    );
    return loginInfo;
  },
  resetProfileInfos() {
    const serverUrl = this.serverUrl;
    this.removeUserPasswordFromTBVault();
    Preferences.resetBranch("linshare");
    this.serverUrl = serverUrl;
  },
  storeFunc(functionalities) {
    const TBPrefs = {
      "linshare.ACCUSED_OF_SHARING": "accusedOfSharing",
      "linshare.NO_DOWNLOAD": "noDownload",
      "linshare.SECURE_SHARE": "secureShare",
    };
    for (let key in TBPrefs) {
      const k = TBPrefs[key];
      const isInTB = Preferences.has(key);
      if (!isInTB && functionalities[TBPrefs[key]]) {
        Preferences.set(k, functionalities[TBPrefs[key]]);
      }
    }
  },
};
