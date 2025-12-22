// Modernized for Thunderbird 140+ - using Services injection
const { Preferences } = ChromeUtils.importESModule("resource://linshare-modules/preferences.sys.mjs");
const { ROUTES } = ChromeUtils.importESModule("resource://linshare-modules/routes.sys.mjs");
const { LinshareUtils } = ChromeUtils.importESModule("resource://linshare-modules/linshareUtils.sys.mjs");
const { userProfile } = ChromeUtils.importESModule("resource://linshare-modules/profileStorage.sys.mjs");

let Services = null;
let _i18n = null;

export function setServices(services) {
  Services = services;
}

export function setI18n(i18n) {
  _i18n = i18n;
}

function i18n(key, fallback = "") {
  if (_i18n) return _i18n(key) || fallback;
  return fallback;
}

export function setBrowserContext(browser) {
  // No-op, we use Services now
}

export const LinshareAPI = {
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
  async checkVersionAndCred(apiVersion, password, code) {
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

    if (response.status == 200) {
      if (url.includes("version")) {
        let body = LinshareUtils.handleResponse(response);
        let version = `v${body.version.charAt(0)}`;
        Preferences.set("linshare.API_VERSION", version);
      }
      return { ok: true };
    }

    return { ok: false };
  },
  async uploadFile(file, uploadProgress, passwordOverride) {
    console.log("LinshareAPI.uploadFile called with file:", file.name);
    let password = passwordOverride;

    // Check auth type from profile
    const authType = userProfile.authType;
    console.log("Auth Type:", authType);

    if (authType === "basic" && !password) {
      try {
        console.log("Getting user password from profile...");
        password = await userProfile.getUserPassword();
      } catch (error) {
        console.error("Error getting password:", error);
        throw error;
      }
    } else if (authType === "jwt") {
      console.log("Using JWT Auth");
      // Password not needed for JWT, but we pass null or empty string to getRequestContext
      // The token is retrieved from userProfile inside getRequestContext
      password = "";
    } else {
      console.log("Using provided password override or non-basic auth");
    }

    console.log("Building request context...");
    let { headers, url, ctype } = LinshareUtils.getRequestContext(
      ROUTES,
      "uploadFileUrl",
      userProfile.connexionInfos,
      password
    );

    console.log("LinShare Upload URL:", url);
    console.log("LinShare Upload Content-Type:", ctype);

    let formData = new FormData();
    formData.append("filename", file.name);
    formData.append("file", file);
    formData.append("filesize", file.size);
    headers.delete("Content-Type");
    headers.append("Content-Type", "multipart/form-data");

    if (ctype == "application/json") {
      headers.append("Accept", "application/json");
    }

    // Pass progress callback to _fetch if provided
    let progressCallback = null;
    if (uploadProgress && typeof uploadProgress === 'function') {
      progressCallback = uploadProgress;
    }

    console.log("Sending upload request...");
    let response = await LinshareUtils._fetch(
      url,
      {
        method: "POST",
        headers,
        body: formData,
      },
      progressCallback
    );

    console.log("Upload response status:", response.status);
    let uuid;
    if (response.status === 200) {
      uuid = LinshareUtils.handleResponse(response, "uuid");
      console.log("Upload successful, UUID:", uuid);
    } else if (response.status === 401) {
      console.log("Authentication failed, retrying...");
      let check = await this.checkCredentials(password);
      if (check.ok) {
        return await this.uploadFile(file, uploadProgress, password);
      } else {
        if (Services && Services.prompt) {
          Services.prompt.alert(null, i18n("loginFailedTitle", "Login Failed"), i18n("loginFailedMsg", "Login Failed, check your credentials"));
        } else {
          console.error("Login Failed - Services.prompt not available");
        }
      }
    } else {
      console.error("Upload failed with status:", response.status);
      uuid = await LinshareUtils.handleError(response);
    }
    console.log("Returning UUID:", uuid);
    return uuid;
  },
  async shareMulipleDocuments(attachementsUuids, recipients, pathv2 = null, passwordOverride) {
    let password = passwordOverride;

    // Check auth type from profile
    const authType = userProfile.authType;

    if (authType === "basic" && !password) {
      try {
        password = await userProfile.getUserPassword();
      } catch (error) {
        throw error;
      }
    } else if (authType === "jwt") {
      password = "";
    }
    let { headers, url, ctype } = LinshareUtils.getRequestContext(
      ROUTES,
      "multipleShareDocumentsUrl",
      userProfile.connexionInfos,
      password
    );

    if (pathv2) {
      url = pathv2;
    }

    let requests = LinshareUtils.buildShareRequest(
      headers,
      url,
      attachementsUuids,
      recipients,
      userProfile.apiVersion,
      ctype,
      userProfile.userPrefs // Pass user preferences as options
    );

    let responses = [];
    for (let i = 0; i < requests.length; i++) {
      let response = await LinshareUtils._fetch(
        requests[i].url,
        requests[i].init,
        null
      );
      if (response.status === 200) {
        responses.push(LinshareUtils.handleResponse(response));
      } else if (response.status === 401) {
        let check = await this.checkCredentials(password);
        if (check.ok) {
          await this.shareMulipleDocuments(attachementsUuids, recipients, null, password);
        }
      } else {
        await LinshareUtils.handleError(response);
      }
    }
    return responses;
  },
};
