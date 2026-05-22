"use strict";

console.log("LinShare: Module initialization started");

console.log("LinShare: Initializing...");

// Module references - will be loaded in onStartup
let LinshareAPI = null;
let userProfile = null;

// Resolve a usable Services object once, with fallbacks for whatever
// the current Thunderbird actually exposes:
//   1. The ambient `Services` global (available in chrome scopes on many
//      versions).
//   2. Importing `Services.sys.mjs` from gre (works on older TB, removed
//      in some 14x builds).
//   3. A minimal stub built directly from Components — `getProtocolHandler`
//      and `newURI` are all we need.
// This function is called lazily so a ReferenceError on undefined globals
// is caught and we move to the next strategy.
function resolveServices() {
  try {
    if (typeof Services !== "undefined" && Services && Services.io) {
      console.log("LinShare: Using ambient Services global");
      return Services;
    }
  } catch (e) { /* fall through */ }

  try {
    const mod = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
    if (mod && mod.Services && mod.Services.io) {
      console.log("LinShare: Using Services from importESModule");
      return mod.Services;
    }
  } catch (e) { /* fall through */ }

  console.log("LinShare: Building Services stub from Components");
  const Cc = Components.classes;
  const Ci_ = Components.interfaces;
  return {
    io: Cc["@mozilla.org/network/io-service;1"].getService(Ci_.nsIIOService),
  };
}

// Build a safe i18n getter from an extension object. `localeData.getMessage`
// was removed in TB 140; try the known APIs in order, then no-op. Modules
// have English fallback strings everywhere they call i18n(key, fallback).
function makeI18nFn(extension) {
  try {
    const ld = extension && extension.localeData;
    if (ld && typeof ld.getMessage === "function") return ld.getMessage.bind(ld);
    if (ld && typeof ld.localizeMessage === "function") return ld.localizeMessage.bind(ld);
    if (extension && typeof extension.localizeMessage === "function") {
      return extension.localizeMessage.bind(extension);
    }
  } catch (e) { /* fall through */ }
  return () => null;
}

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
      const svc = resolveServices();
      const resProt = svc.io.getProtocolHandler("resource")
        .QueryInterface(Ci.nsIResProtocolHandler);
      const modulesURI = svc.io.newURI(extension.rootURI.resolve("modules/"));
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
          const i18nFn = makeI18nFn(extension);
          const prefModule = ChromeUtils.importESModule("resource://linshare-modules/preferences.sys.mjs");
          if (prefModule.setServices) prefModule.setServices(Services);

          if (profileModule.setServices) profileModule.setServices(Services);
          if (profileModule.setI18n) profileModule.setI18n(i18nFn);

          const apiModule = ChromeUtils.importESModule("resource://linshare-modules/linshareAPI.sys.mjs");
          if (apiModule.setServices) apiModule.setServices(Services);
          if (apiModule.setI18n) apiModule.setI18n(i18nFn);

          const utilsModule = ChromeUtils.importESModule("resource://linshare-modules/linshareUtils.sys.mjs");
          if (utilsModule.setServices) utilsModule.setServices(Services);
          if (utilsModule.setI18n) utilsModule.setI18n(i18nFn);

          const uiModule = ChromeUtils.importESModule("resource://linshare-modules/TBUIHandlers.sys.mjs");
          if (uiModule.setServices) uiModule.setServices(Services);
          if (uiModule.setI18n) uiModule.setI18n(i18nFn);

          console.log("LinShare: Services and I18n injected into modules");
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
      const svc = resolveServices();
      const resProt = svc.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
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
        const svc = resolveServices();
        const resProt = svc.io.getProtocolHandler("resource")
          .QueryInterface(Ci.nsIResProtocolHandler);

        if (!resProt.hasSubstitution("linshare-modules")) {
          const modulesURI = svc.io.newURI(extension.rootURI.resolve("modules/"));
          resProt.setSubstitution("linshare-modules", modulesURI);
          console.log("LinShare: Resource alias registered in getAPI -> " + modulesURI.spec);
        }

        if (extension) {
          const i18nFn = makeI18nFn(extension);

          const apiModule = ChromeUtils.importESModule("resource://linshare-modules/linshareAPI.sys.mjs");
          LinshareAPI = apiModule.LinshareAPI;
          console.log("LinShare: LinshareAPI loaded:", !!LinshareAPI);

          const profileModule = ChromeUtils.importESModule("resource://linshare-modules/profileStorage.sys.mjs");
          userProfile = profileModule.userProfile;
          console.log("LinShare: userProfile loaded:", !!userProfile);

          const utilsModule = ChromeUtils.importESModule("resource://linshare-modules/linshareUtils.sys.mjs");
          const uiModule = ChromeUtils.importESModule("resource://linshare-modules/TBUIHandlers.sys.mjs");

          // Inject Services into every module so they can use Services.prefs,
          // Services.logins (password vault), etc. `svc` here is the full
          // ambient Services on TB 115+, or a stub built from Components.
          if (profileModule.setServices) profileModule.setServices(svc);
          if (apiModule.setServices) apiModule.setServices(svc);
          if (utilsModule.setServices) utilsModule.setServices(svc);
          if (uiModule.setServices) uiModule.setServices(svc);

          if (profileModule.setI18n) profileModule.setI18n(i18nFn);
          if (apiModule.setI18n) apiModule.setI18n(i18nFn);
          if (utilsModule.setI18n) utilsModule.setI18n(i18nFn);
          if (uiModule.setI18n) uiModule.setI18n(i18nFn);

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
            // Ensure authType and jwtToken are passed if present
            userProfile.setRuntimeConfig(settings);
          }

          // Extract password from settings if available (only for Basic Auth)
          const password = settings ? settings.USER_PASSWORD : null;

          // Helper to manage progress UI in compose window
          const getComposeWindow = () => {
            try {
              // Use the context's window manager to get the most recent compose window
              if (context && context.extension && context.extension.windowManager) {
                const windows = context.extension.windowManager.getAll();
                for (let win of windows) {
                  if (win.window && win.window.document && win.window.document.location.href.includes("messengercompose")) {
                    return win.window;
                  }
                }
              }
              console.warn("Could not find compose window via context");
              return null;
            } catch (e) {
              console.error("Error getting compose window:", e);
              return null;
            }
          };

          const _overlayI18nFn = makeI18nFn(context.extension);
          const overlayI18n = (key, fallback) => {
            try {
              return _overlayI18nFn(key) || fallback;
            } catch (e) {
              return fallback;
            }
          };

          const updateProgressUI = (window, fileName, current, total, percent) => {
            if (!window || !window.document) return;
            let doc = window.document;
            let overlay = doc.getElementById("linshare-progress-overlay");

            if (!overlay) {
              overlay = doc.createElement("div");
              overlay.id = "linshare-progress-overlay";
              overlay.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 380px;
                background: #ffffff;
                color: #0f172a;
                border-radius: 14px;
                box-shadow: 0 16px 48px rgba(11, 60, 100, 0.22), 0 2px 6px rgba(0, 0, 0, 0.06);
                z-index: 9999;
                font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
                overflow: hidden;
              `;

              let header = doc.createElement("div");
              header.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 18px 14px;
                border-bottom: 1px solid #eef2f6;
              `;

              let icon = doc.createElement("div");
              icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                <path d="M12.2 12.4H4.1a2.8 2.8 0 0 1-.7-5.55A3.8 3.8 0 0 1 10.85 5.6 2.8 2.8 0 0 1 12.2 12.4z" stroke="#1E88E5" stroke-width="1.25" stroke-linejoin="round" fill="none"/>
                <path d="M8 10.8V5.5M8 5.5L6.3 7.2M8 5.5l1.7 1.7" stroke="#1E88E5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>`;
              icon.style.cssText = "display: flex; align-items: center; flex-shrink: 0;";
              header.appendChild(icon);

              let titleWrap = doc.createElement("div");
              titleWrap.style.cssText = "flex: 1; min-width: 0;";

              let title = doc.createElement("div");
              title.textContent = overlayI18n("uploadOverlayTitle", "Sharing with LinShare");
              title.style.cssText = "font-weight: 700; font-size: 14px; color: #0f172a; letter-spacing: -0.005em;";
              titleWrap.appendChild(title);

              let counter = doc.createElement("div");
              counter.id = "linshare-progress-counter";
              counter.style.cssText = "font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; font-variant-numeric: tabular-nums;";
              titleWrap.appendChild(counter);

              header.appendChild(titleWrap);
              overlay.appendChild(header);

              let body = doc.createElement("div");
              body.style.cssText = "padding: 14px 18px 16px;";

              let text = doc.createElement("div");
              text.id = "linshare-progress-text";
              text.style.cssText = `
                font-size: 13px;
                color: #334155;
                margin-bottom: 12px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-weight: 500;
              `;
              body.appendChild(text);

              let progressContainer = doc.createElement("div");
              progressContainer.style.cssText = `
                width: 100%;
                height: 6px;
                background: #eef2f6;
                border-radius: 999px;
                overflow: hidden;
                margin-bottom: 6px;
              `;

              let progressBar = doc.createElement("div");
              progressBar.id = "linshare-progress-bar";
              progressBar.style.cssText = `
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #1E88E5 0%, #38bdf8 100%);
                transition: width 0.3s ease;
                border-radius: 999px;
              `;
              progressContainer.appendChild(progressBar);
              body.appendChild(progressContainer);

              let percentText = doc.createElement("div");
              percentText.id = "linshare-progress-percent";
              percentText.style.cssText = `
                text-align: right;
                font-size: 11.5px;
                color: #94a3b8;
                font-weight: 600;
                font-variant-numeric: tabular-nums;
              `;
              body.appendChild(percentText);

              overlay.appendChild(body);
              doc.body.appendChild(overlay);
            }

            let text = doc.getElementById("linshare-progress-text");
            let bar = doc.getElementById("linshare-progress-bar");
            let percentText = doc.getElementById("linshare-progress-percent");
            let counter = doc.getElementById("linshare-progress-counter");

            if (text) text.textContent = fileName;
            if (counter) counter.textContent = `${current} / ${total}`;
            if (bar) bar.style.width = `${percent}%`;
            if (percentText) percentText.textContent = `${percent}%`;
          };

          const removeProgressUI = (window) => {
            if (!window || !window.document) return;
            let overlay = window.document.getElementById("linshare-progress-overlay");
            if (overlay) overlay.remove();
          };

          const composeWin = getComposeWindow();

          try {
            let uploadedFiles = [];
            for (let i = 0; i < files.length; i++) {
              let file = files[i];
              console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);

              // Update UI - Start of file
              const baseProgress = (i / files.length) * 100;
              updateProgressUI(composeWin, file.name, i + 1, files.length, Math.round(baseProgress));

              // Create progress callback for this specific file
              const progressCallback = (loaded, total) => {
                const fileProgress = (loaded / total) * 100;
                const overallProgress = baseProgress + (fileProgress / files.length);
                updateProgressUI(composeWin, file.name, i + 1, files.length, Math.round(overallProgress));
              };

              // Pass password and progress callback to uploadFile
              let uuid = await LinshareAPI.uploadFile(file, progressCallback, password);
              if (uuid) {
                uploadedFiles.push(uuid);
                console.log(`File ${file.name} uploaded with UUID: ${uuid}`);

                // Update UI - End of file (100% for this file)
                const completedProgress = ((i + 1) / files.length) * 100;
                updateProgressUI(composeWin, file.name, i + 1, files.length, Math.round(completedProgress));
              } else {
                throw new Error(`Upload failed for ${file.name} (no UUID)`);
              }
            }

            console.log("Sharing documents with recipients...");
            if (composeWin && composeWin.document) {
              let text = composeWin.document.getElementById("linshare-progress-text");
              let bar = composeWin.document.getElementById("linshare-progress-bar");
              let percentText = composeWin.document.getElementById("linshare-progress-percent");
              if (text) text.textContent = overlayI18n("uploadOverlayFinalizing", "Finalising share…");
              if (bar) bar.style.width = "100%";
              if (percentText) percentText.textContent = "";
            }

            // Pass password to shareMulipleDocuments
            await LinshareAPI.shareMulipleDocuments(uploadedFiles, recipients, null, password);
            console.log("Files shared successfully via LinShare");
            return null; // Success
          } catch (error) {
            console.error("Upload error:", error);
            return error.message;
          } finally {
            removeProgressUI(composeWin);
          }
        },
        async getUserSettings() {
          console.log("getUserSettings called");
          return userProfile.allInfos;
        },
        async saveUserAccount(serverUrl, baseUrl, userEmail, password, mustSave, authType, jwtToken) {
          console.log("saveUserAccount called");
          userProfile.serverUrl = serverUrl.replace(/\/$/, "");
          userProfile.baseUrl = baseUrl.replace(/^\//, "") || "linshare";
          userProfile.userEmail = userEmail;
          userProfile.mustSave = mustSave;
          userProfile.authType = authType || "basic";
          userProfile.jwtToken = jwtToken || "";
          userProfile.displayName = userEmail;
          userProfile.apiVersion = "v5";

          if (userProfile.authType === "basic" && password) {
            await userProfile.saveUserPasswordInTBVault(password, mustSave);
          }

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
          // `alert` is undefined in the parent-experiment scope; route through
          // Services.prompt so the user actually sees errors instead of the
          // silent no-op the old `alert()` call produced.
          console.log(`prompt: ${type} - ${title}: ${msg}`);
          try {
            const svc = resolveServices();
            if (svc && svc.prompt && typeof svc.prompt.alert === "function") {
              svc.prompt.alert(null, title || "LinShare", msg || "");
            }
          } catch (e) {
            console.error("LinShare: prompt failed:", e);
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
