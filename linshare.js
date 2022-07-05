"use strict";
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");

var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");
var { LinshareAPI } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareAPI.jsm"));
var { userProfile } = ChromeUtils.import(extension.rootURI.resolve("modules/profileStorage.jsm"));
var { TBUIHandlers } = ChromeUtils.import(extension.rootURI.resolve("modules/TBUIHandlers.jsm"));

var linshareExtAPI = class extends ExtensionCommon.ExtensionAPI {
  checked = false;
  onStartup() {
    console.log("loading linshare Plugin");
    Services.io
      .getProtocolHandler("resource")
      .QueryInterface(Ci.nsIResProtocolHandler)
      .setSubstitution("linshare", this.extension.rootURI);

    let aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
      Ci.amIAddonManagerStartup
    );
    let manifestURI = Services.io.newURI("manifest.json", null, this.extension.rootURI);

    this.chromeHandle = aomStartup.registerChrome(manifestURI, [["content", "linshare", "assets/"]]);
    let sendingEvt = (winId) => {
      return this.extension.emit("linshareExtAPI.onSendBtnClick", winId);
    };

    ExtensionSupport.registerWindowListener("linshare-send-btn", {
      chromeURLs: ["chrome://messenger/content/messengercompose/messengercompose.xhtml"],
      onLoadWindow: function (win) {
        console.log("chrome://linshare/resource/content/views/composerOverlay.jsm");
        var { composerOverlay } = ChromeUtils.import(
          extension.rootURI.resolve("content/views/composerOverlay.jsm")
        );
        composerOverlay(sendingEvt, win);
      },
    });
    this.initListener();
    this.changeDefaultMessage();
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
  changeDefaultMessage() {
    // the default mail message of old versions mislead user because the recipient received it after the mail with shared documents sent by linshare server.
    let oldMessage =
      /Un deuxième courriel vous sera adressé ultérieurement pour télécharger vos fichiers depuis l'application de partage LinShare./;
    let newMessage = `Un premier courriel vous a été adressé précédemment pour télécharger vos fichiers depuis l'application de partage LinShare.
    `;
    let actualMessage = userProfile.message;
    if (!actualMessage || actualMessage.match(oldMessage)) userProfile.message = newMessage;
  }

  initListener() {
    const checkUserInfos = async (evt, pwd) => {
      try {
        let USER_INFOS = userProfile.connexionInfos;
        if (!pwd) pwd = await userProfile.getUserPasswordFromTBVault();
        if (!pwd) return false;

        const checked = await LinshareAPI.checkVersionAndCred(userProfile.apiVersion, pwd);
        if (!checked.ok) return checked;

        // USER_INFOS.API_VERSION = Preferences.get("linshare.API_VERSION") || "v5";
        this.checked = true;

        const profile = await LinshareAPI.checkCredentials(pwd);
        await this.updateUserProfile(profile, pwd);
        return checked;
      } catch (error) {
        return error;
      }
    };
    this.extension.on("check-user-infos", checkUserInfos);

    const getUserInfos = async () => {
      let USER_INFOS = userProfile.allInfos;
      checkUserInfos();

      if (USER_INFOS instanceof Error) return USER_INFOS;
      let pwd = await userProfile.getUserPasswordFromTBVault();
      if (pwd) USER_INFOS = { ...USER_INFOS, USER_PASSWORD: pwd };
      return USER_INFOS;
    };
    this.extension.on("get-user-infos", getUserInfos);

    const getUserPrefs = async () => {
      return userProfile.userPrefs;
    };
    this.extension.on("get-user-prefs", getUserPrefs);

    const setUserPrefs = async (evt, args) => {
      try {
        userProfile.userPrefs = args;
        return { success: true, message: "User preferences succesfully saved!" };
      } catch (error) {
        return error;
      }
    };
    this.extension.on("set-user-prefs", setUserPrefs);

    const resetUser = async () => {
      userProfile.resetProfileInfos();
    };
    this.extension.on("reset-user", resetUser);

    const sendAndShare = async (evt, meta) => {
      let [files, recipients] = meta;
      try {
        if (!userProfile.getUserPasswordFromTBVault()) {
          let passDialog = await TBUIHandlers.promptCredentialsForm();
          if (!passDialog.pass) throw new Error("Password must be filled");
          const check = await extension.emit("check-user-infos", passDialog.pass);
          if (!check[0].ok) throw new Error(check[0].MESSAGE);
          if (passDialog.checked) userProfile.saveUserPasswordInTBVault(passDialog.pass, check[0]);
          else TBUIHandlers.savePassInCurrentWin(passDialog.pass);
        }
        TBUIHandlers.createProgressList();
        let sendFilesUuid = [];
        for (let i = 0; i < files.length; i++) {
          let uploadProgress = function () {
            return TBUIHandlers.createProgress(files[i]);
          };
          try {
            let uuid = await LinshareAPI.uploadFile(files[i], uploadProgress);
            if (typeof uuid == "string") {
              sendFilesUuid.push(uuid);
            } else if (uuid[0]?.textContent) {
              sendFilesUuid.push(uuid[0].textContent);
            }
          } catch (error) {
            throw error;
          }
        }
        if (sendFilesUuid.length > 0) {
          try {
            await LinshareAPI.shareMulipleDocuments(sendFilesUuid, recipients);
            TBUIHandlers.getCurrentComposeWindow().RemoveAllAttachments();
          } catch (error) {
            throw error;
          }
        } else {
          throw new Error(`File uploaded failed`);
        }
      } catch (error) {
        throw error;
      }
    };
    this.extension.on("send-and-share", sendAndShare);

    // onStart check if version has changed test all versions from v5 to v1
    userProfile.apiVersion = "v5";
    checkUserInfos();
  }
  async updateUserProfile({ profile }, pwd) {
    try {
      userProfile.displayName = `${profile.firstName} ${profile.lastName}`;
      let USER_INFOS = userProfile.connexionInfos;
      let functionalities = await LinshareAPI.getFunctionalities(pwd);
      if (functionalities) userProfile.storeFunc(functionalities);
      let { ok, quota } = await LinshareAPI.getUserQuota(pwd, profile.quotaUuid);
      if (!ok) return;
      let q = Number.parseFloat((quota.usedSpace / quota.quota) * 100).toFixed(2);
      userProfile.userQuota = q;
    } catch (error) {
      return error;
    }
  }

  getAPI(context) {
    context.callOnClose(this);

    return {
      linshareExtAPI: {
        async sendAndShare(files, recipients) {
          try {
            await extension.emit("send-and-share", [files, recipients]);
            return;
          } catch (error) {
            return error.message;
          }
        },
        async getUserSettings() {
          const userInfos = await extension.emit("get-user-infos");
          return userInfos[0];
        },
        async saveUserAccount(SERVEUR_URL, BASE_URL, USER_EMAIL, password, MUST_SAVE) {
          userProfile.serverUrl = SERVEUR_URL.replace(/\/$/, "");
          userProfile.baseUrl = BASE_URL.replace(/^\//, "");
          userProfile.userEmail = USER_EMAIL;
          userProfile.mustSave = MUST_SAVE;

          Preferences.set("mail.compose.big_attachments.insert_notification", false);
          Preferences.set("mail.compose.big_attachments.notify", false);

          const check = await extension.emit("check-user-infos", password);

          if (check && check[0].ok && MUST_SAVE) {
            return await userProfile.saveUserPasswordInTBVault(password, check[0]);
          } else if (check && check[0].ok && !MUST_SAVE) {
            return {
              MESSAGE: "Your account is succesfully check[0]ed,your password is not saved",
              success: true,
            };
          } else if (check && !check[0].ok && check[0].MESSAGE) {
            return { MESSAGE: check[0].MESSAGE, success: false };
          } else {
            return {
              MESSAGE: "Something went wrong, please check your credentials",
              success: false,
            };
          }
        },
        async getUserPrefs() {
          const userPrefs = await extension.emit("get-user-prefs");
          return userPrefs[0];
        },
        async saveUserPrefs(message, accusedOfSharing, noDownload, secureShare) {
          let prefs = { message, accusedOfSharing, noDownload, secureShare };
          let isSaved = await extension.emit("set-user-prefs", prefs);
          return isSaved[0];
        },

        prompt(type, title, msg) {
          TBUIHandlers.prompt(type, title, msg);
        },
        sendMail() {
          TBUIHandlers.getCurrentComposeWindow().goDoCommand("cmd_sendNow");
        },
        async resetPrefs() {
          await extension.emit("reset-user", arguments);
        },
        //=============== EVENTS ===============//
        onSendBtnClick: new ExtensionCommon.EventManager({
          context,
          name: "linshareExtAPI.onSendBtnClick",
          register: (fire, options) => {
            let listener = async (event, id) => {
              console.log("linshare.onSendBtnClick");
              await fire.async(id);
              return event;
            };

            context.extension.on("linshareExtAPI.onSendBtnClick", listener);
            return () => {
              context.extension.off("linshareExtAPI.onSendBtnClick", listener);
            };
          },
        }).api(),
      },
    };
  }

  close() {
    let chargedModules = ["modules/linshareAPI.jsm"];
    chargedModules.forEach((module) => {
      Cu.unload(extension.getURL(module));
    });
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);
  }
};
