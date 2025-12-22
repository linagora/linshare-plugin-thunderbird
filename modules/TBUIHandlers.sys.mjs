// Modernized for Thunderbird 140+ - removed all Services dependencies
// UI handlers simplified to work without deprecated SharedPromptUtils

const { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
const extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");

let _i18n = null;

export function setI18n(i18n) {
  _i18n = i18n;
}

function i18n(key, fallback = "") {
  if (_i18n) return _i18n(key) || fallback;
  return fallback;
}

export const TBUIHandlers = {
  // Removed getCurrentComposeWindow() - we now use tab references from WebExtension API

  async prompt(type, title, msg) {
    // Use browser.notifications API instead of Services.prompt
    await browser.notifications.create({
      type: "basic",
      title: title,
      message: msg
    });
  },

  async promptCredentialsForm(userEmail) {
    // Simplified password prompt using native prompt
    // In a production app, you'd use a proper HTML dialog
    return {
      pass: "", // Password will be handled separately through options page
      checked: false,
      ok: false
    };
  },

  savePassInCurrentWin(pass) {
    // Password storage now handled via browser.storage.local in profileStorage module
    console.log("Password will be saved via storage API");
  },

  createProgressList() {
    // This function manipulates DOM - keeping it but noting it requires window access
    // May need to be called from background.js context instead
    console.log("Progress list creation - to be handled in compose window");
  },

  addToProgressList(fileNbr, fileName) {
    console.log(`Progress: ${fileName} (${fileNbr})`);
  },

  removeProgressFromList() {
    console.log("Progress complete");
  },

  async displayMessage(message) {
    await browser.notifications.create({
      type: "basic",
      title: i18n("extensionName", "LinShare"),
      message: message
    });
  }
};
