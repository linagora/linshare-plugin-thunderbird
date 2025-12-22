// Modernized for Thunderbird 140+ - using Services injection
const { Preferences, setServices: setPreferencesServices } = ChromeUtils.importESModule("resource://linshare-modules/preferences.sys.mjs");
const { TBUIHandlers } = ChromeUtils.importESModule("resource://linshare-modules/TBUIHandlers.sys.mjs");

let Services = null;
let _i18n = null;

export function setServices(services) {
  Services = services;
  setPreferencesServices(services);
}

export function setI18n(i18n) {
  _i18n = i18n;
}

function i18n(key, fallback = "") {
  if (_i18n) return _i18n(key) || fallback;
  return fallback;
}

export const userProfile = {
  availablePrefs: {
    v5: ["message", "accusedOfSharing", "noDownload", "secureShare"],
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
      if (pref == "message" && !prefs[pref]) throw new Error(i18n("errMessageRequired", "Message field cannot be empty"));
      if (prefs[pref] != null && prefs[pref] != undefined) {
        this[pref] = prefs[pref];
      }
    }
  },

  get connexionInfos() {
    if (!this.serverUrl) throw new Error(i18n("errServerUrlRequired", "Server URL cannot be empty"));
    return {
      SERVER_URL: this.serverUrl,
      USER_EMAIL: this.userEmail,
      API_VERSION: this.apiVersion,
      BASE_URL: this.baseUrl,
      AUTH_TYPE: this.authType,
      JWT_TOKEN: this.jwtToken,
    };
  },

  get allInfos() {
    if (!this.serverUrl) return new Error(i18n("errServerUrlRequired", "Server URL cannot be empty"));
    return {
      ...this.connexionInfos,
      USER_DISPLAYNAME: this.displayName,
      USER_QUOTA: this.userQuota,
    };
  },

  // Runtime config to override Preferences (injected from background.js)
  _runtimeConfig: null,

  setRuntimeConfig(config) {
    this._runtimeConfig = config;
  },

  // Synchronous getters/setters using Preferences (which uses Services.prefs)
  // Now checking _runtimeConfig first
  get serverUrl() { return this._runtimeConfig?.SERVER_URL || Preferences.get("linshare.SERVER_URL") || null; },
  set serverUrl(url) { Preferences.set("linshare.SERVER_URL", url); },

  get baseUrl() { return this._runtimeConfig?.BASE_URL || Preferences.get("linshare.BASE_URL") || "/linshare"; },
  set baseUrl(url) { Preferences.set("linshare.BASE_URL", url); },

  get userEmail() { return this._runtimeConfig?.USER_EMAIL || Preferences.get("linshare.USER_EMAIL") || null; },
  set userEmail(email) { Preferences.set("linshare.USER_EMAIL", email); },

  get apiVersion() { return this._runtimeConfig?.API_VERSION || Preferences.get("linshare.API_VERSION") || "v5"; },
  set apiVersion(version) { Preferences.set("linshare.API_VERSION", version); },

  get mustSave() { return this._runtimeConfig?.MUST_SAVE || Preferences.get("linshare.MUST_SAVE") || false; },
  set mustSave(save) { Preferences.set("linshare.MUST_SAVE", save); },

  get authType() { return this._runtimeConfig?.AUTH_TYPE || Preferences.get("linshare.AUTH_TYPE") || "basic"; },
  set authType(type) { Preferences.set("linshare.AUTH_TYPE", type); },

  get jwtToken() { return this._runtimeConfig?.JWT_TOKEN || Preferences.get("linshare.JWT_TOKEN") || null; },
  set jwtToken(token) { Preferences.set("linshare.JWT_TOKEN", token); },

  get displayName() { return Preferences.get("linshare.USER_DISPLAYNAME") || ""; },
  set displayName(displayName) { Preferences.set("linshare.USER_DISPLAYNAME", displayName); },

  get userQuota() { return Preferences.get("linshare.USER_QUOTA") || 0; },
  set userQuota(quota) { Preferences.set("linshare.USER_QUOTA", quota); },

  get message() {
    return this._runtimeConfig?.userPrefs?.message || Preferences.get(
      "linshare.MESSAGE",
      i18n("defaultShareMessage", "Your document has been shared via LinShare")
    );
  },
  set message(message) { Preferences.set("linshare.MESSAGE", message); },

  get accusedOfSharing() {
    if (this._runtimeConfig?.userPrefs?.accusedOfSharing !== undefined) {
      return this._runtimeConfig.userPrefs.accusedOfSharing;
    }
    return Preferences.get("linshare.ACCUSED_OF_SHARING", false);
  },
  set accusedOfSharing(val) { Preferences.set("linshare.ACCUSED_OF_SHARING", val); },

  get noDownload() {
    if (this._runtimeConfig?.userPrefs?.noDownload !== undefined) {
      return this._runtimeConfig.userPrefs.noDownload;
    }
    return Preferences.get("linshare.NO_DOWNLOAD", false);
  },
  set noDownload(val) { Preferences.set("linshare.NO_DOWNLOAD", val); },

  get secureShare() {
    if (this._runtimeConfig?.userPrefs?.secureShare !== undefined) {
      return this._runtimeConfig.userPrefs.secureShare;
    }
    return Preferences.get("linshare.SECURE_SHARE", false);
  },
  set secureShare(val) { Preferences.set("linshare.SECURE_SHARE", val); },

  // Password management using ExtensionStorage (compatible with options.js)
  async getUserPassword() {
    try {
      // 1. Try native vault first (most secure)
      if (Services && Services.logins && this.serverUrl) {
        let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
        if (logins && logins.length > 0) {
          let log = logins.find((l) => l.username === this.userEmail);
          if (log) {
            console.log("LinShare: Password found in native vault");
            return log.password;
          }
        }
      }

      // 2. Fallback to ExtensionStorage (legacy/migration)
      let ExtensionStorage;
      try {
        const esModule = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorage.sys.mjs");
        ExtensionStorage = esModule.ExtensionStorage;
      } catch (e) {
        console.error("ExtensionStorage not found", e);
      }

      if (ExtensionStorage) {
        const data = await ExtensionStorage.get("linshare@linagora", ["linshareUserInfos"]);
        if (data?.linshareUserInfos?.USER_PASSWORD) {
          console.log("LinShare: Password found in ExtensionStorage (legacy)");
          return data.linshareUserInfos.USER_PASSWORD;
        }
      }

      throw new Error(i18n("errNoPasswordFound", "No password found for user"));
    } catch (error) {
      console.error("Error getting password:", error);
      throw error;
    }
  },

  async saveUserPasswordInTBVault(userPassword, remember) {
    if (!Services || !Services.logins) {
      console.error("LinShare: Services.logins not available");
      return { success: false, MESSAGE: "Login manager not available" };
    }

    try {
      const loginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);
      loginInfo.init(
        this.serverUrl,
        null, // No form submit URL
        this.serverUrl,
        this.userEmail,
        userPassword,
        "",
        ""
      );

      // Check if login already exists
      let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
      let existing = logins.find(l => l.username === this.userEmail);

      if (existing) {
        Services.logins.modifyLogin(existing, loginInfo);
        console.log("LinShare: Password updated in native vault");
      } else {
        Services.logins.addLogin(loginInfo);
        console.log("LinShare: Password added to native vault");
      }
      return { success: true, MESSAGE: "Password saved in native vault" };
    } catch (e) {
      console.error("LinShare: Error saving password to native vault:", e);
      return { success: false, MESSAGE: e.message };
    }
  },

  // Legacy encrypted storage - keeping for reference but likely unused if options.js is standard
  async saveUserPasswordEncrypted(userPassword, remember) {
    return { success: true, MESSAGE: "Deprecated" };
  },

  async getUserPasswordEncrypted() {
    return null;
  },

  resetProfileInfos() {
    // Clear preferences
    Preferences.resetBranch("linshare.");

    // Clear native vault
    if (Services && Services.logins && this.serverUrl) {
      try {
        let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
        let existing = logins.find(l => l.username === this.userEmail);
        if (existing) {
          Services.logins.removeLogin(existing);
          console.log("LinShare: Password removed from native vault");
        }
      } catch (e) {
        console.error("LinShare: Error clearing native vault:", e);
      }
    }
  },

  storeFunc(functionalityName, functionalityValue) {
    Preferences.set(`linshare.FUNCTIONALITY.${functionalityName}`, functionalityValue);
  },

  getFunc(functionalityName) {
    return Preferences.get(`linshare.FUNCTIONALITY.${functionalityName}`);
  }
};

// Simple password encryption using WebCrypto API (Same as before)
const PasswordStore = {
  async getEncryptionKey() {
    const pepper = "linshare-thunderbird-extension-2024";
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(pepper),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("linshare-salt"),
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  },

  async encrypt(password) {
    const enc = new TextEncoder();
    const key = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(password)
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  },

  async decrypt(encryptedB64) {
    const dec = new TextDecoder();
    const key = await this.getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    return dec.decode(decrypted);
  }
};
