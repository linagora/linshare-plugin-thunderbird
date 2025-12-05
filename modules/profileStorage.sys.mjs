// Modernized for Thunderbird 140+ - using Services injection
const { Preferences, setServices: setPreferencesServices } = ChromeUtils.importESModule("resource://linshare-modules/preferences.sys.mjs");
const { TBUIHandlers } = ChromeUtils.importESModule("resource://linshare-modules/TBUIHandlers.sys.mjs");

let Services = null;

export function setServices(services) {
  Services = services;
  setPreferencesServices(services);
}

export const userProfile = {
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
      AUTH_TYPE: this.authType,
      JWT_TOKEN: this.jwtToken,
    };
  },

  get allInfos() {
    if (!this.serverUrl) return new Error("Server URL cannot be empty");
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
    return Preferences.get(
      "linshare.MESSAGE",
      "Un premier courriel vous a été adressé précédemment pour télécharger vos fichiers depuis l'application de partage LinShare."
    );
  },
  set message(message) { Preferences.set("linshare.MESSAGE", message); },

  get accusedOfSharing() { return Preferences.get("linshare.ACCUSED_OF_SHARING", true); },
  set accusedOfSharing(val) { Preferences.set("linshare.ACCUSED_OF_SHARING", val); },

  get noDownload() { return Preferences.get("linshare.NO_DOWNLOAD", true); },
  set noDownload(val) { Preferences.set("linshare.NO_DOWNLOAD", val); },

  get secureShare() { return Preferences.get("linshare.SECURE_SHARE", true); },
  set secureShare(val) { Preferences.set("linshare.SECURE_SHARE", val); },

  // Password management using ExtensionStorage (compatible with options.js)
  async getUserPassword() {
    try {
      // Try to read from WebExtension storage first (where options.js saves it)
      // We need to dynamically import ExtensionStorage if not available
      let ExtensionStorage;
      try {
        const esModule = ChromeUtils.importESModule("resource://gre/modules/ExtensionStorage.sys.mjs");
        ExtensionStorage = esModule.ExtensionStorage;
      } catch (e) {
        // Fallback for older versions if needed, but TB 120+ should have it
        console.error("ExtensionStorage not found", e);
      }

      if (ExtensionStorage) {
        console.log("LinShare: ExtensionStorage available, trying to get data for linshare@linagora");
        try {
          const data = await ExtensionStorage.get("linshare@linagora", ["linshareUserInfos"]);
          console.log("LinShare: ExtensionStorage data retrieved:", JSON.stringify(data));

          if (data && data.linshareUserInfos) {
            console.log("LinShare: linshareUserInfos found");
            if (data.linshareUserInfos.USER_PASSWORD) {
              console.log("LinShare: Password found in ExtensionStorage");
              return data.linshareUserInfos.USER_PASSWORD;
            } else {
              console.log("LinShare: USER_PASSWORD missing in linshareUserInfos");
            }
          } else {
            console.log("LinShare: linshareUserInfos missing in data");
          }
        } catch (storageError) {
          console.error("LinShare: Error reading ExtensionStorage:", storageError);
        }
      } else {
        console.error("LinShare: ExtensionStorage NOT available");
      }

      // Fallback to Services.logins (legacy)
      if (Services && Services.logins) {
        let logins = Services.logins.findLogins(this.serverUrl, null, this.serverUrl);
        if (logins && logins.length > 0) {
          let log = logins.filter((login) => login.username == this.userEmail);
          if (log && log.length > 0) {
            return log[0].password;
          }
        }
      }

      throw new Error('No password found for user');
    } catch (error) {
      console.error("Error getting password:", error);
      throw error;
    }
  },

  async saveUserPasswordInTBVault(userPassword, remember) {
    // This is mainly called by legacy code or if we wanted to save from backend
    // But options.js handles saving now.
    // We'll leave this as a no-op or fallback.
    return { success: true, MESSAGE: "Password management handled by options page" };
  },

  // Legacy encrypted storage - keeping for reference but likely unused if options.js is standard
  async saveUserPasswordEncrypted(userPassword, remember) {
    return { success: true, MESSAGE: "Deprecated" };
  },

  async getUserPasswordEncrypted() {
    return null;
  },

  resetProfileInfos() {
    Preferences.resetBranch("linshare.");
    // Also clear extension storage?
    // ExtensionStorage.set("linshare@linagora", { linshareUserInfos: {} });
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
