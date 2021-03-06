"use strict"
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");

var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { LinshareUtils } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareUtils.jsm"));
var { LinshareAPI } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareAPI.jsm"));

this.linshare = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    console.log("loading linshare Plugin")
    Services.io
      .getProtocolHandler("resource")
      .QueryInterface(Ci.nsIResProtocolHandler)
      .setSubstitution("linshare", this.extension.rootURI);

    let aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
      Ci.amIAddonManagerStartup
    );
    let manifestURI = Services.io.newURI("manifest.json", null, this.extension.rootURI);

    this.chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "linshare", "assets/"],
    ]);
    let sendingEvt = (winId) => { return this.extension.emit('linshare.onSendBtnClick', winId) }

    ExtensionSupport.registerWindowListener("linshare-send-btn", {
      chromeURLs: [
        "chrome://messenger/content/messengercompose/messengercompose.xhtml"
      ],
      onLoadWindow: function (win) {
        console.log("chrome://linshare/resource/content/views/composerOverlay.jsm")
        var { composerOverlay } = ChromeUtils.import(extension.rootURI.resolve("content/views/composerOverlay.jsm"));
        composerOverlay(sendingEvt, win)
      },
    });
  }
  onShutdown(isAppShutdown) {
    if (isAppShutdown) {
      return;
    }
    ExtensionSupport.unregisterWindowListener("linshare-send-btn");

    Services.io
      .getProtocolHandler("resource")
      .QueryInterface(Ci.nsIResProtocolHandler)
      .setSubstitution("gdata-provider", null);

    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }
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
        async saveUserAccount(SERVEUR_URL, BASE_URL, USER_EMAIL, password, MUST_SAVE) {
          Preferences.set("linshare.SERVER_URL", SERVEUR_URL.replace(/\/$/, ''))
          Preferences.set("linshare.BASE_URL", '/' + BASE_URL.replace(/^\//, ''))
          Preferences.set("linshare.USER_EMAIL", USER_EMAIL)
          Preferences.set("linshare.MUST_SAVE", MUST_SAVE)

          Preferences.set("mail.compose.big_attachments.insert_notification", false)
          Preferences.set("mail.compose.big_attachments.notify", false)

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
        },
        //=============== EVENTS ===============//
        onSendBtnClick: new ExtensionCommon.EventManager({
          context,
          name: "linshare.onSendBtnClick",
          register: (fire, options) => {
            let listener = async (event, id) => {
              console.log('linshare.onSendBtnClick')
              await fire.async(id)
              return event;
            };

            context.extension.on("linshare.onSendBtnClick", listener);
            return () => {
              context.extension.off("linshare.onSendBtnClick", listener);
            };
          },
        }).api(),


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