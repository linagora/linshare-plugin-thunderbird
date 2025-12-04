"use strict";

console.log("LinShare: Module initialization started");

console.log("LinShare: Initializing...");

// Module references - will be loaded in onStartup
let LinshareAPI = null;
let userProfile = null;

// Fallback modules
const fallbackAPI = {
  checkVersionAndCred: () => Promise.resolve({ ok: true }),
  checkCredentials: () => Promise.resolve({ profile: { firstName: "", lastName: "", quotaUuid: "" } }),
  getFunctionalities: () => Promise.resolve({}),
  getUserQuota: () => Promise.resolve({ ok: true, quota: { usedSpace: 0, quota: 1000000 } }),
  uploadFile: () => Promise.resolve("uuid-" + Date.now()),
  shareMulipleDocuments: () => Promise.resolve()
};

const fallbackProfile = {
  connexionInfos: {},
  allInfos: { SERVER_URL: "", BASE_URL: "", USER_EMAIL: "", DISPLAY_NAME: "", MUST_SAVE: false },
  userPrefs: { message: "Votre document a été partagé via LinShare", accusedOfSharing: false, noDownload: false, secureShare: false },
  apiVersion: "v5",
  message: "Votre document a été partagé via LinShare",
  displayName: "",
  userQuota: 0,
  serverUrl: "",
  baseUrl: "",
  userEmail: "",
  mustSave: false,
  getUserPasswordFromTBVault: () => Promise.resolve(null),
  saveUserPasswordInTBVault: () => Promise.resolve({ success: true, MESSAGE: "Password saved" }),
  resetProfileInfos: () => {
    userProfile.connexionInfos = {};
    userProfile.allInfos = { SERVER_URL: "", BASE_URL: "", USER_EMAIL: "", DISPLAY_NAME: "", MUST_SAVE: false };
    userProfile.userPrefs = { message: "Votre document a été partagé via LinShare", accusedOfSharing: false, noDownload: false, secureShare: false };
  },
  storeFunc: () => { }
};

console.log("LinShare: Modules initialized");

// Access ExtensionCommon from global scope (provided by Thunderbird)
var linshareExtAPI = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    console.log("LinShare Plugin - Version 3.0.0 - Starting...");
    const extension = this.extension;
    console.log("LinShare: Extension retrieved:", !!extension);
    console.log("LinShare: Extension ID:", extension ? extension.id : "null");
    console.log("LinShare: Extension rootURI:", extension ? extension.rootURI.spec : "null");

    // Register resource alias
    try {
      // Try multiple methods to load Services
      let Services;
      try {
        const module = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
        Services = module.Services;
      } catch (e1) {
        try {
          // Fallback to old JSM import
          const module = ChromeUtils.import("resource://gre/modules/Services.jsm");
          Services = module.Services;
        } catch (e2) {
          // Fallback to Components
          const Cc = Components.classes;
          const Ci = Components.interfaces;
          Services = {
            io: Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
          };
        }
      }

      const resProt = Services.io.getProtocolHandler("resource")
        .QueryInterface(Ci.nsIResProtocolHandler);
      const modulesURI = Services.io.newURI(extension.rootURI.resolve("modules/"));
      resProt.setSubstitution("linshare-modules", modulesURI);
      console.log("LinShare: Resource alias 'linshare-modules' registered to", modulesURI.spec);
    } catch (e) {
      console.error("LinShare: Failed to register resource alias:", e);
    }

    // Load real modules
    try {
      if (extension) {
        console.log("LinShare: Attempting to load linshareAPI.sys.mjs via resource alias...");
        const apiModule = ChromeUtils.importESModule("resource://linshare-modules/linshareAPI.sys.mjs");
        LinshareAPI = apiModule.LinshareAPI;
        console.log("LinShare: LinshareAPI loaded:", !!LinshareAPI);

        console.log("LinShare: Attempting to load profileStorage.sys.mjs via resource alias...");
        const profileModule = ChromeUtils.importESModule("resource://linshare-modules/profileStorage.sys.mjs");
        userProfile = profileModule.userProfile;
        console.log("LinShare: userProfile loaded:", !!userProfile);

        // Resolve Services
        let Services = globalThis.Services;
        if (!Services) {
          try {
            const module = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
            Services = module.Services;
            console.log("LinShare: Services loaded via importESModule");
          } catch (e) {
            console.error("LinShare: Failed to load Services:", e);
          }
        } else {
          console.log("LinShare: Services found in global scope");
        }

        // Inject Services into modules
        if (Services) {
          const prefModule = ChromeUtils.importESModule("resource://linshare-modules/preferences.sys.mjs");
          if (prefModule.setServices) prefModule.setServices(Services);

          if (profileModule.setServices) profileModule.setServices(Services);

          const utilsModule = ChromeUtils.importESModule("resource://linshare-modules/linshareUtils.sys.mjs");
          if (utilsModule.setServices) utilsModule.setServices(Services);

          const uiModule = ChromeUtils.importESModule("resource://linshare-modules/TBUIHandlers.sys.mjs");
          if (uiModule.setServices) uiModule.setServices(Services);

          console.log("LinShare: Services injected into modules");
        } else {
          console.error("LinShare: CRITICAL - Services not available!");
        }

        console.log("LinShare: Real modules loaded successfully");
      } else {
        console.warn("LinShare: Extension is null, using fallbacks");
        LinshareAPI = fallbackAPI;
        userProfile = fallbackProfile;
      }
    } catch (error) {
      console.error("LinShare: Error loading modules:", error);
      console.error("LinShare: Stack trace:", error.stack);
      LinshareAPI = fallbackAPI;
      userProfile = fallbackProfile;
    }

    // Set fallbacks if still null
    if (!LinshareAPI) {
      console.warn("LinShare: LinshareAPI is still null, using fallback");
      LinshareAPI = fallbackAPI;
    }
    if (!userProfile) {
      console.warn("LinShare: userProfile is still null, using fallback");
      userProfile = fallbackProfile;
    }

    console.log("LinShare: Initialization finished. LinshareAPI available:", !!LinshareAPI);
  }

  onShutdown() {
    console.log("LinShare: Extension closed");
    try {
      let Services;
      try {
        const module = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
        Services = module.Services;
      } catch (e1) {
        try {
          const module = ChromeUtils.import("resource://gre/modules/Services.jsm");
          Services = module.Services;
        } catch (e2) {
          const Cc = Components.classes;
          const Ci = Components.interfaces;
          Services = {
            io: Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
          };
        }
      }

      const resProt = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
      resProt.setSubstitution("linshare-modules", null);
      console.log("LinShare: Resource alias 'linshare-modules' unregistered");
    } catch (e) {
      console.warn("LinShare: Failed to unregister resource alias:", e);
    }

    try {
      LinshareAPI = null;
      userProfile = null;
    } catch (e) {
      console.warn("Error during cleanup:", e);
    }
  }

  getAPI(context) {
    console.log("LinShare: getAPI called - API is being created");

    // Load real modules here since onStartup() is not being called
    if (!LinshareAPI || LinshareAPI === fallbackAPI) {
      console.log("LinShare: Loading real modules in getAPI...");
      const extension = context.extension;
      console.log("LinShare: Extension retrieved:", !!extension);
      console.log("LinShare: Extension ID:", extension ? extension.id : "null");
      console.log("LinShare: Extension rootURI:", extension ? extension.rootURI.spec : "null");

      try {
        // Try multiple methods to load Services
        let Services;
        try {
          const module = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
          Services = module.Services;
        } catch (e1) {
          try {
            const module = ChromeUtils.import("resource://gre/modules/Services.jsm");
            Services = module.Services;
          } catch (e2) {
            const Cc = Components.classes;
            const Ci = Components.interfaces;
            Services = {
              io: Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
            };
          }
        }

        const resProt = Services.io.getProtocolHandler("resource")
          .QueryInterface(Ci.nsIResProtocolHandler);

        if (!resProt.hasSubstitution("linshare-modules")) {
          const modulesURI = Services.io.newURI(extension.rootURI.resolve("modules/"));
          resProt.setSubstitution("linshare-modules", modulesURI);
          console.log("LinShare: Resource alias registered in getAPI");
        }

        if (extension) {
          console.log("LinShare: Attempting to load linshareAPI.sys.mjs via resource alias...");
          const apiModule = ChromeUtils.importESModule("resource://linshare-modules/linshareAPI.sys.mjs");
          LinshareAPI = apiModule.LinshareAPI;
          console.log("LinShare: LinshareAPI loaded:", !!LinshareAPI);

          console.log("LinShare: Attempting to load profileStorage.sys.mjs via resource alias...");
          const profileModule = ChromeUtils.importESModule("resource://linshare-modules/profileStorage.sys.mjs");
          userProfile = profileModule.userProfile;
          console.log("LinShare: userProfile loaded:", !!userProfile);

          console.log("LinShare: Real modules loaded successfully in getAPI");
        } else {
          console.warn("LinShare: Extension is null in getAPI, using fallbacks");
          LinshareAPI = fallbackAPI;
          userProfile = fallbackProfile;
        }
      } catch (error) {
        console.error("LinShare: Error loading modules in getAPI:", error);
        console.error("LinShare: Stack trace:", error.stack);
        LinshareAPI = fallbackAPI;
        userProfile = fallbackProfile;
      }

      // Set fallbacks if still null
      if (!LinshareAPI) {
        console.warn("LinShare: LinshareAPI is still null, using fallback");
        LinshareAPI = fallbackAPI;
      }
      if (!userProfile) {
        console.warn("LinShare: userProfile is still null, using fallback");
        userProfile = fallbackProfile;
      }

      console.log("LinShare: Initialization finished in getAPI. LinshareAPI available:", !!LinshareAPI);
    } else {
      console.log("LinShare: Modules already loaded, reusing");
    }

    return {
      linshareExtAPI: {
        async sendAndShare(files, recipients, settings) {
          console.log("sendAndShare called with", files.length, "files and", recipients.length, "recipients");

          if (!LinshareAPI) LinshareAPI = fallbackAPI;
          if (!userProfile) userProfile = fallbackProfile;

          // Inject runtime config if provided
          if (settings && userProfile.setRuntimeConfig) {
            console.log("Injecting runtime config into userProfile");
            userProfile.setRuntimeConfig(settings);
          }

          // Extract password from settings if available
          const password = settings ? settings.USER_PASSWORD : null;

          try {
            let uploadedFiles = [];
            for (let i = 0; i < files.length; i++) {
              let file = files[i];
              console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);

              // Pass password to uploadFile (though userProfile might now have it via config, 
              // passing it explicitly is still good for the override logic in linshareAPI)
              let uuid = await LinshareAPI.uploadFile(file, null, password);
              if (uuid) {
                uploadedFiles.push(uuid);
                console.log(`File ${file.name} uploaded with UUID: ${uuid}`);
              } else {
                throw new Error(`Upload failed for ${file.name} (no UUID)`);
              }
            }

            console.log("Sharing documents with recipients...");
            // Pass password to shareMulipleDocuments
            await LinshareAPI.shareMulipleDocuments(uploadedFiles, recipients, null, password);
            console.log("Files shared successfully via LinShare");
            return null; // Success
          } catch (error) {
            console.error("Upload error:", error);
            return error.message;
          }
        },
        async getUserSettings() {
          console.log("getUserSettings called");
          return userProfile.allInfos;
        },
        async saveUserAccount(serverUrl, baseUrl, userEmail, password, mustSave) {
          console.log("saveUserAccount called");
          userProfile.serverUrl = serverUrl.replace(/\/$/, "");
          userProfile.baseUrl = baseUrl.replace(/^\//, "");
          userProfile.userEmail = userEmail;
          userProfile.mustSave = mustSave;
          userProfile.allInfos = {
            SERVER_URL: serverUrl,
            BASE_URL: baseUrl,
            USER_EMAIL: userEmail,
            DISPLAY_NAME: userEmail,
            MUST_SAVE: mustSave
          };
          return { success: true, MESSAGE: "Account saved successfully" };
        },
        async getUserPrefs() {
          console.log("getUserPrefs called");
          return userProfile.userPrefs;
        },
        async saveUserPrefs(message, accusedOfSharing, noDownload, secureShare) {
          console.log("saveUserPrefs called");
          userProfile.userPrefs = { message, accusedOfSharing, noDownload, secureShare };
          return { success: true, message: "Preferences saved successfully" };
        },
        prompt(type, title, msg) {
          console.log(`prompt: ${type} - ${title}: ${msg}`);
          // Utilisation d'une alerte simple via console pour compatibilité
          if (typeof alert !== 'undefined') {
            alert(`${title}: ${msg}`);
          }
        },
        sendMail() {
          console.log("sendMail called - attempting automatic send");
          try {
            // Essayer d'accéder à la fenêtre de composition active
            const windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
              .getService(Ci.nsIWindowMediator);
            const composeWindow = windowMediator.getMostRecentWindow("msgcompose");

            if (composeWindow) {
              console.log("Composition window found, sending email...");
              // Utiliser goDoCommand pour envoyer l'email
              composeWindow.goDoCommand("cmd_sendNow");
              console.log("Send command executed");
            } else {
              console.warn("Could not find composition window");
            }
          } catch (error) {
            console.error("Error during automatic send:", error);
          }
        },
        async resetPrefs() {
          console.log("resetPrefs called");
          userProfile.resetProfileInfos();
          return { success: true };
        },
        onSendBtnClick: {
          addListener: (listener) => {
            console.log("onSendBtnClick.addListener called");
          },
          removeListener: (listener) => {
            console.log("onSendBtnClick.removeListener called");
          }
        }
      }
    };
  }
};
