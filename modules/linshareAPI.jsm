var EXPORTED_SYMBOLS = ["LinshareAPI"];

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { ROUTES } = ChromeUtils.import(extension.rootURI.resolve("modules/routes.js"));
var { LinshareUtils } = ChromeUtils.import(extension.rootURI.resolve("modules/linshareUtils.jsm"));
var { userProfile } = ChromeUtils.import(extension.rootURI.resolve("modules/profileStorage.jsm"));

var LinshareAPI = {
  async checkCredentials(password, code = null) {
    let { headers, url } = LinshareUtils.getRequestContext(
      ROUTES,
      "authentication",
      userProfile.connexionInfos,
      password
    );

    if (code) {
      headers.append("x-linShare-2fa-pin", code);
    }
    let response = await LinshareUtils._fetch(url, { headers }, null);

    if (response.status == 200) return { ok: true, profile: LinshareUtils.handleResponse(response) };

    return { ok: false };
  },
  async getUserQuota(password, quotaUid) {
    if (!password) {
      return;
    }
    let { headers, url } = LinshareUtils.getRequestContext(
      ROUTES,
      "quota",
      userProfile.connexionInfos,
      password
    );

    url += `/${quotaUid}`;

    let response = await LinshareUtils._fetch(url, { headers }, null);

    if (response.status == 200) return { ok: true, quota: LinshareUtils.handleResponse(response) };

    return { ok: false };
  },
  async checkVersionAndCred(apiVersion, password, code, versionTested = []) {
    let { headers, url } = LinshareUtils.getRequestContext(
      ROUTES,
      "APIVersion",
      userProfile.connexionInfos,
      password,
      apiVersion
    );

    if (code) {
      headers.append("x-linShare-2fa-pin", code);
    }
    let response = await LinshareUtils._fetch(url, { headers }, null);

    const API_VERSION = apiVersion;
    let currentVersion = API_VERSION;

    let nextVersion = currentVersion;
    let keys = Object.keys(ROUTES.suportedBaseVersion);
    let vidx = keys.indexOf(currentVersion) + 1;
    if (vidx < keys.length) {
      nextVersion = keys[vidx];
    } else {
      nextVersion = "v1";
    }
    if (response.status == 200) {
      if (url.includes("version")) {
        let body = LinshareUtils.handleResponse(response);
        let version = `v${body.version.charAt(0)}`;
        Preferences.set("linshare.API_VERSION", version);
      }
      if (response.headers.has("set-cookie")) {
        let cookie = response.headers.get("set-cookie").replace(" ", "").split(";");
        let tocken = cookie[0].split("=");
        Services.cookies.add(
          userProfile.connexionInfos.SERVER_URL,
          "/",
          tocken[0],
          tocken[1],
          true,
          true,
          true,
          Date.now() + 3000,
          {},
          0,
          1
        );
      }
      return { ok: true };
    } else if (
      response.headers.has("x-linshare-auth-error-code") &&
      response.headers.get("x-linshare-auth-error-code") == "1002"
    ) {
      let code = LinshareUtils.needTOTPCode();
      if (!code) {
        return { ok: false };
      }
      return this.checkVersionAndCred(API_VERSION, password, code);
    } else if (response.headers.has("x-linshare-auth-error-msg")) {
      return {
        MESSAGE: response.headers.get("x-linshare-auth-error-msg"),
        ok: false,
      };
    } else if (response.status == 404) {
      if (versionTested.includes(nextVersion)) return { ok: false };

      Preferences.set("linshare.API_VERSION", nextVersion);

      return this.checkVersionAndCred(nextVersion, password, code, versionTested);
    } else if (response.status == 401 && response.headers.has("cookie")) {
      Services.cookie.removeCookiesFromExactHost(SERVER_URL, {});
      return this.checkVersionAndCred(nextVersion, password, code, versionTested);
    } else if (!versionTested.includes(nextVersion)) {
      versionTested.push(API_VERSION);
      return this.checkVersionAndCred(nextVersion, password, code, versionTested);
    }

    return { ok: false };
  },
  async uploadFile(file, uploadProgress) {
    let password;
    try {
      password = await userProfile.getUserPassword();
    } catch (error) {
      throw error;
    }
    let { headers, url, ctype } = LinshareUtils.getRequestContext(
      ROUTES,
      "uploadFileUrl",
      userProfile.connexionInfos,
      password
    );

    let formData = new FormData();
    formData.append("filename", file.name);
    formData.append("file", file);
    formData.append("filesize", file.size);
    headers.delete("Content-Type");
    headers.append("Content-Type", "multipart/form-data");

    if (ctype == "application/json") {
      headers.append("Accept", "application/json");
    }
    let progressElem = uploadProgress();
    let response = await LinshareUtils._fetch(
      url,
      {
        method: "POST",
        headers,
        body: formData,
      },
      progressElem
    );

    let uuid;
    if (response.status === 200) {
      progressElem.querySelector(".progress-bar").classList.add("bg-success");
      uuid = LinshareUtils.handleResponse(response, "uuid");
    } else if (response.status === 401) {
      let check = await this.checkCredentials(password);
      if (check.ok) {
        await this.uploadFile(USER_INFOS, file);
      } else {
        Services.prompt.alert(
          this.CURRENT_COMPOSER(),
          "Login Failed",
          "Login Failed, check your credentials"
        );
      }
    } else {
      progressElem.querySelector(".progress-bar").classList.add("bg-danger");
      uuid = await LinshareUtils.handleError(response);
    }
    return uuid;
  },
  async shareMulipleDocuments(attachementsUuids, recipients, pathv2 = null) {
    let password;
    try {
      password = await userProfile.getUserPassword();
    } catch (error) {
      throw error;
    }
    let { headers, url, ctype } = LinshareUtils.getRequestContext(
      ROUTES,
      "multipleShareDocumentsUrl",
      userProfile.connexionInfos,
      password
    );

    let requests = LinshareUtils.buildShareRequest(
      headers,
      url,
      attachementsUuids,
      recipients,
      userProfile.apiVersion,
      ctype
    );
    for (let i = 0; i < requests.length; i++) {
      let response = await LinshareUtils._fetch(requests[i].url, requests[i].init, this.progress);
      if (response.status != 200 && response.status != 204) {
        let message = "";
        if (response.type == "application/json") {
          let body = LinshareUtils.handleResponse(response);
          if (body && body.message) {
            message = "with error message : ";
            message += body.message;
          }
        }
        throw new Error(message);
      }
    }
  },
  async getFunctionalities(pwd) {
    let password;
    try {
      password = await userProfile.getUserPassword();
    } catch (error) {
      if (pwd) password = pwd;
      else throw error;
    }

    let { headers, url } = LinshareUtils.getRequestContext(
      ROUTES,
      "getFunctionalities",
      userProfile.connexionInfos,
      password
    );

    let response = await LinshareUtils._fetch(url, { headers }, null);
    if (response.status == 200) {
      let res = LinshareUtils.handleResponse(response);
      return LinshareUtils.getwantedPrefs(res);
    }
    return false;
  },
};

console.log("Loading LinshareAPI module");
