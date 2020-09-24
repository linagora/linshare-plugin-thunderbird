"use strict"
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");

var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { LinshareUtils } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareUtils.jsm"));
var { LinshareAPI } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareAPI.jsm"));

this.linshare = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    context.callOnClose(this);

    return {
      linshare: {
        async sendAndShare(files, recipients) {

          let uploadProgressList = LinshareUtils.createProgressList();

          let sendFilesUuid = [];
          for (let i = 0; i < files.length; i++) {
            let uploadProgress = function () { return LinshareUtils.createProgress(files[i]) }
            try {
              let uuid = await LinshareAPI.uploadFile(USER_INFOS, files[i], uploadProgress);
              if (typeof uuid == "string") {
                sendFilesUuid.push(uuid);
              } else if (uuid[0]?.textContent) {
                sendFilesUuid.push(uuid[0].textContent);
              }
            } catch (e) {
              break
            }

          }
          if (sendFilesUuid.length > 0) {
            let isSend = await LinshareAPI.shareMulipleDocuments(USER_INFOS, sendFilesUuid, recipients)
            if (isSend.ok) {
              LinshareUtils.getCurrentComposeWindow().RemoveAllAttachments()
              return { ok: true }
            }
            return { ok: false, message: `File uploaded but sharing failed ${isSend.message ? isSend.message : ""}` }
          }
          return { ok: false, message: `Uploading file failed ` }

        },
        async getUserSettings() {
          let userSettings = USER_INFOS.SERVER_URL ? { "SERVER_URL": USER_INFOS.SERVER_URL(), "USER_EMAIL": USER_INFOS.USER_EMAIL(), "API_VERSION": USER_INFOS.API_VERSION() } : {};
          if (Object.entries(userSettings).length != 0) {
            let pwd = await LinshareUtils.getUserPassword(USER_INFOS.SERVER_URL(), USER_INFOS.USER_EMAIL())
            if (pwd) userSettings = { ...userSettings, "USER_PASSWORD": pwd }
            return userSettings;
          }
          return false;
        },
        async getUserPrefs() {
          return await LinshareUtils.isProfilPrefs(USER_INFOS.API_VERSION())
        },
        async saveUserAccount(SERVEUR_URL, USER_EMAIL, password, MUST_SAVE) {
          Preferences.set("linshare.SERVER_URL", SERVEUR_URL)
          Preferences.set("linshare.USER_EMAIL", USER_EMAIL)
          Preferences.set("linshare.MUST_SAVE", MUST_SAVE)
          let check = await LinshareAPI.checkCredentials(SERVEUR_URL, USER_EMAIL, USER_INFOS.API_VERSION(), password)

          if (check.ok && MUST_SAVE) {
            return await LinshareUtils.setUserPassword(SERVEUR_URL, USER_EMAIL, password, check)
          }
          else if (check.ok && !MUST_SAVE) {
            return { 'MESSAGE': 'Your account is succesfully checked,your password is not saved', 'success': true };
          }
          else if (!check.ok && check.MESSAGE) {
            return { 'MESSAGE': check.MESSAGE, 'success': false };
          } else {
            return { 'MESSAGE': 'Something went wrong, please check your credentials', 'success': false };
          }
        },
        async saveUserPrefs(message, accusedOfSharing, noDownload, secureShare) {
          return await LinshareUtils.setUserPreferences(USER_INFOS.API_VERSION(), message, accusedOfSharing, noDownload, secureShare)
        },
        prompt(type, title, msg) {
          LinshareUtils.prompt(type, title, msg)
        },
        sendMail() {
          LinshareUtils.getCurrentComposeWindow().goDoCommand('cmd_sendNow');
        }

      }
    };
  }

  close() {
    let chargedModules = ["modules/linshareUtils.jsm", "modules/linshareAPI.jsm"]
    chargedModules.forEach(module => {
      Cu.unload(extension.getURL(module));
    })
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);
  }
};
const USER_INFOS = {
  SERVER_URL: function () {
    return Preferences.get("linshare.SERVER_URL")
  },
  USER_EMAIL: function () {
    return Preferences.get("linshare.USER_EMAIL")
  },
  API_VERSION: function () {
    return Preferences.get("linshare.API_VERSION") || 'v2'
  }
}