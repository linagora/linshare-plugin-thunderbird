// Modernized for Thunderbird 140+ - removed Services dependencies
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");


const { Preferences } = ChromeUtils.importESModule("resource://linshare-modules/preferences.sys.mjs");
const { TBUIHandlers } = ChromeUtils.importESModule("resource://linshare-modules/TBUIHandlers.sys.mjs");

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

export const LinshareUtils = {
  getRequestContext(ROUTES, endpoint, USER_INFOS, password, apiVersion = null) {
    let { SERVER_URL, USER_EMAIL, API_VERSION, BASE_URL, AUTH_TYPE, JWT_TOKEN } = USER_INFOS;
    if (apiVersion) API_VERSION = apiVersion;
    let ctype = this.getCType(ROUTES, endpoint, API_VERSION);
    let url = this.buildVersionUrl(ROUTES, endpoint, SERVER_URL, API_VERSION, BASE_URL);

    let authorization;
    if (AUTH_TYPE === "jwt" && JWT_TOKEN) {
      authorization = `Bearer ${JWT_TOKEN}`;
    } else {
      authorization = `Basic ${btoa(`${USER_EMAIL}:${password}`)}`;
    }

    let headers = this.buidRequestHeaders(authorization, ctype, SERVER_URL);
    return { headers, url, ctype };
  },
  buildShareRequest(headers, url, attachementsUuids, recipients, apiVersion, ctype, options = {}) {
    let requests = [];
    let init = {
      method: "POST",
      headers,
    };
    let body = this.buildRequestBody(attachementsUuids, recipients, options);
    init.headers.append("accept", ctype);
    init.body = JSON.stringify(body);
    requests.push({ url, init });
    return requests;
  },
  handleResponse(response, field = null) {
    let contentType = response.type;
    if (contentType.includes("application/json")) {
      return field ? JSON.parse(response.body)[field] : JSON.parse(response.body);
    }
  },
  async handleError(err) {
    let errorMessage = i18n("uploadFailed", "Upload failed");

    // Handle timeout errors
    if (err.status === 504) {
      errorMessage = i18n("uploadTimeout", "Upload timeout - the server took too long to respond. Please try with a smaller file or check your connection.");
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Handle other HTTP errors
    if (err.status === 420) {
      errorMessage = i18n("errQuotaReached", "The account quota has been reached.");
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (err.status === 451) {
      errorMessage = i18n("errVirusFound", "File contains virus");
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Try to parse JSON error message
    try {
      if (err.body && typeof err.body === 'string') {
        const errorData = JSON.parse(err.body);
        if (errorData.message) {
          errorMessage = errorData.message;
          if (errorData.errCode === "46011") {
            throw new Error(errorMessage);
          }
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, use a generic message
      console.error("Failed to parse error response:", parseError);
      errorMessage = `Upload failed with status ${err.status}`;
    }

    console.error(errorMessage);
    throw new Error(errorMessage);
  },
  _fetch(url, opts = {}, progressElem = null) {
    return new Promise((res, rej) => {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method || "get", url);
      // xhr.withCredentials = true; // Causing DOMException in system module, and not needed for Basic Auth
      for (var pair of opts.headers.entries() || {}) {
        if (pair[0] == "cookie") pair[0] = "Cookie";
        xhr.setRequestHeader(pair[0], pair[1]);
      }
      xhr.onload = (e) =>
        res({
          type: e.target.getResponseHeader("Content-Type"),
          body: e.target.response,
          headers: this.makeResponseHeaders(e.target.getAllResponseHeaders()),
          status: e.target.status,
        });
      xhr.onerror = rej;
      if (xhr.upload && progressElem && typeof progressElem === 'function') {
        xhr.upload.onprogress = function ({ loaded, total }) {
          progressElem(loaded, total);
        };
      }
      if (opts.body) {
        let body = opts.body;
        xhr.send(body);
      } else if (opts.params) {
        let params = opts.params;
        xhr.send(params);
      } else {
        xhr.send();
      }
    });
  },
  makeResponseHeaders(str) {
    let headers = str
      .match(/.*/g)
      .filter((e) => e)
      .map((e) => {
        return e.split(":");
      });
    return new Headers(Object.fromEntries(headers));
  },

  async getwantedPrefs(res) {
    let prefs = {};

    let wantedPrefs = {
      SECOND_FACTOR_AUTHENTICATION: "2fa",
      SHARE_CREATION_ACKNOWLEDGEMENT_FOR_OWNER: "accusedOfSharing",
      UNDOWNLOADED_SHARED_DOCUMENTS_ALERT: "noDownload",
      UPLOAD_REQUEST__SECURED_URL: "secureShare",
    };

    for (let pref of res) {
      if (Object.keys(wantedPrefs).includes(pref.identifier)) {
        if (pref.enable && pref.canOverride) prefs[wantedPrefs[pref.identifier]] = pref.value;
      }
    }
    return prefs;
  },
  needTOTPCode() {
    let code = {};
    let patern = new RegExp("^[0-9]{6}");
    let dialog;
    while (!patern.test(code.value)) {
      dialog = Services.prompt.prompt(
        TBUIHandlers.getCurrentComposeWindow(),
        i18n("totpTitle", "TOTP code"),
        i18n("totpPrompt", "Please enter the TOTP code generated by your app"),
        code,
        null,
        {
          value: false,
        }
      );
      if (!dialog) {
        return false;
      }
    }
    return code.value;
  },
  buildVersionUrl(ROUTES, endpoint, SERVER_URL, API_VERSION, BASE_URL) {
    let routeUrl = "";
    if (ROUTES[endpoint][API_VERSION]?.url) {
      routeUrl = ROUTES[endpoint][API_VERSION].url;
    } else if (Object.keys(ROUTES.suportedBaseVersion).includes(API_VERSION)) {
      routeUrl = ROUTES[endpoint].base.url.replace(/#base#/, ROUTES.suportedBaseVersion[API_VERSION]);
    }
    return `${SERVER_URL}/${BASE_URL}${routeUrl}`;
  },
  getCType(ROUTES, endpoint, API_VERSION) {
    let ctype = "";
    if (ROUTES[endpoint][API_VERSION]?.ctype) {
      ctype = ROUTES[endpoint][API_VERSION].ctype;
    } else if (Object.keys(ROUTES.suportedBaseVersion).includes(API_VERSION)) {
      ctype = ROUTES[endpoint].base.ctype;
    }
    return ctype;
  },
};
console.log("Loading LinshareUtils module");
