var EXPORTED_SYMBOLS = ["TBUIHandlers"];
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { PromptUtils } = ChromeUtils.import("resource://gre/modules/SharedPromptUtils.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");

const TBUIHandlers = {
  getCurrentComposeWindow() {
    return Services.wm.getMostRecentWindow("msgcompose");
  },
  prompt(type, title, msg) {
    Services.prompt[type](null, title, msg);
  },
  async promptCredentialsForm(userEmail){
    let args = {
      promptType: "promptPassword",
      title: "Credentials",
      text: `Enter your password for ${userEmail} account`,
      pass: "",
      checkLabel: "Remember me!",
      checked: false,
      ok: false,
    };
    let propBag = PromptUtils.objectToPropBag(args);
    await Services.ww.openWindow(
      this.getCurrentComposeWindow(),
      "chrome://global/content/commonDialog.xhtml",
      "_blank",
      "centerscreen,chrome,modal,titlebar",
      propBag
    );
    PromptUtils.propBagToObject(propBag, args);
    return args
  },
  savePassInCurrentWin(pass) {
    this.getCurrentComposeWindow().credentials = {
      hasPass : true,
      pass
    }
  },
  createProgressList() {
    let composer = this.getCurrentComposeWindow();
    let composerNotification = composer.document.querySelector("#compose-notification-bottom");
    for (let currentElem of composerNotification.children) {
      composerNotification.removeChild(currentElem);
    }
    let progressElement = composer.document.createElement("div");
    progressElement.id = "linshare-progress-list";
    composerNotification.appendChild(progressElement);
  },
  createProgress(file) {
    let composer = this.getCurrentComposeWindow();
    let composerNotification = composer.document.querySelector("#linshare-progress-list");

    let progressContent = `
    <div class="lin-progress-content row" style="width:100vw; padding:10px 3px 0">
      <div class="col-8 ml-2" id="text">
        <span id="lin-file-name">Uploading ${file.name} to LinShare</span>
      </div>
      <div class="col">
        <div class="progress md-progress" style="height: 20px ; width: 100%; float:left">
          <div class="progress-bar" role="progressbar" style="width: 5%; height: 20px" aria-valuenow="0" aria-valuemin="0"
            aria-valuemax="100">%</div>
        </div>
      </div>
    </div>
    `;
    let progressElement = composer.document.createElement("div");
    progressElement.innerHTML = progressContent
      .replace(/[\n]*/g, "")
      .replaceAll(/\s{2,}/g, " ")
      .trim();
    let jQueryScript = composer.document.createElement("script");
    jQueryScript.src = extension.getURL("skin/js/jquery-3.5.1.slim.min.js");
    let bootstrapScript = composer.document.createElement("script");
    bootstrapScript.src = extension.getURL("skin/js/bootstrap.min.js");
    let link = composer.document.createElement("link");
    link.rel = "stylesheet";
    link.href = extension.getURL("skin/css/bootstrap.min.css");
    progressElement.appendChild(link);
    progressElement.appendChild(jQueryScript);
    progressElement.appendChild(bootstrapScript);

    composerNotification.appendChild(progressElement);
    return progressElement;
  },
};
