var EXPORTED_SYMBOLS = ["LinshareUtils"];
var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { TBUIHandlers } = ChromeUtils.import(extension.rootURI.resolve("modules/TBUIHandlers.jsm"));


var LinshareUtils = {
  getRequestContext(ROUTES, endpoint, USER_INFOS, password, apiVersion = null) {
    let { SERVER_URL, USER_EMAIL, API_VERSION, BASE_URL } = USER_INFOS;
    if (apiVersion) API_VERSION = apiVersion;
    let ctype = this.getCType(ROUTES, endpoint, API_VERSION);
    let url = this.buildVersionUrl(ROUTES, endpoint, SERVER_URL, API_VERSION, BASE_URL);
    let authorization = btoa(`${USER_EMAIL}:${password}`);
    let headers = this.buidRequestHeaders(authorization, ctype, SERVER_URL);
    return { headers, url, ctype };
  },
  buildShareRequest(headers, url, attachementsUuids, recipients, apiVersion, ctype) {
    let requests = [];
    let urlParams = apiVersion == "v1" ? this.useUrlParams(attachementsUuids) : [];
    let init = {
      method: "POST",
      headers,
    };
    if (apiVersion == "v1") {
      for (let i = 0; i < recipients.length; i++) {
        urlParams.set("targetMail", recipients[i]);
        let params = urlParams.toString();
        init.params = urlParams;
        requests.push({ url, init });
      }
    } else {
      let body = this.buildRequestBody(attachementsUuids, recipients);
      init.headers.append("accept", ctype);
      init.body = JSON.stringify(body);
      requests.push({ url, init });
    }
    return requests;
  },
  useUrlParams(attachementsUuids) {
    const urlParams = new URLSearchParams();
    for (let i = 0; i < attachementsUuids.length; i++) {
      if (i == 0) {
        urlParams.append("file", attachementsUuids[i]);
      } else {
        urlParams.append("file" + i, attachementsUuids[i]);
      }
    }
    return urlParams;
  },
  buidRequestHeaders(authorization, ctype, serverUrl) {
    let headers = new Headers({
      Authorization: `Basic ${authorization}`,
      redirect: "error",
      "Content-Type": ctype,
      Connection: "close",
      Accept: ctype,
    });
    if (Services.cookies.cookieExists(serverUrl, "/", "JSESSIONID", {})) {
      let cookies = Services.cookies.getCookiesFromHost(serverUrl, {});
      let Cookie = `${cookies[cookies.length - 1].name}=${cookies[cookies.length - 1].value}`;
      headers.append("Cookie", Cookie);
      headers.delete("authorization");
    }
    return headers;
  },
  buildRequestBody(attachementsUuids, recipients) {
    let body = {
      recipients: [],
      documents: [],
    };
    attachementsUuids.forEach((attachementsUuid) => {
      body.documents.push(attachementsUuid);
    });
    recipients.forEach((recipient) => {
      body.recipients.push({ mail: recipient });
    });

    if (Preferences.get("linshare.ACCUSED_OF_SHARING")) {
      body = {
        ...body,
        creationAcknowledgement: Preferences.get("linshare.ACCUSED_OF_SHARING"),
      };
    }
    if (Preferences.get("linshare.SECURE_SHARE")) {
      body = {
        ...body,
        secured: Preferences.get("linshare.SECURE_SHARE"),
      };
    }
    if (Preferences.get("linshare.NO_DOWNLOAD")) {
      let d = new Date();
      d.setDate(d.getDate() + 15);
      let timestamp = d.getTime();
      body = {
        ...body,
        expirationDate: timestamp,
      };
    }

    return body;
  },

  handleResponse(response, field = null) {
    let contentType = response.type;
    if (contentType.includes("application/json")) {
      return field ? JSON.parse(response.body)[field] : JSON.parse(response.body);
    } else if (contentType.includes("application/xml")) {
      var oParser = new DOMParser();
      var text = oParser.parseFromString(response.body, "application/xml");
      return field ? text.getElementsByTagName(field) : text;
    }
  },
  async handleError(err) {
    switch (err.status) {
      case 420:
        Services.prompt.alert(TBUIHandlers.getCurrentComposeWindow(), "Error", "The account quota has been reached.");
        throw new Error("The account quota has been reached.");
      case 451:
        Services.prompt.alert(TBUIHandlers.getCurrentComposeWindow(), "Error", "File contains virus");
      default:
        if (JSON.parse(err.body).message) {
          Services.prompt.alert(TBUIHandlers.getCurrentComposeWindow(), "Error", JSON.parse(err.body).message);
          if ((JSON.parse(err.body).errCode = "46011")) {
            throw new Error(JSON.parse(err.body).message);
          }
        } else {
          Services.prompt.alert(TBUIHandlers.getCurrentComposeWindow(), "Error", "Uploading failed");
        }
    }
  },
  _fetch(url, opts = {}, progressElem = null) {
    return new Promise((res, rej) => {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method || "get", url);
      xhr.withCredentials = true;
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
      if (progressElem) {
        TBUIHandlers.getCurrentComposeWindow().onclose = function (e) {
          e.stopPropagation();
          let confirm = Services.prompt.confirm(
            null,
            "Abort uploading",
            "Uploading to linshare is in process, do you want to stop it"
          );
          if (confirm) {
            xhr.abort();
          } else {
            e.preventDefault();
          }
        };
      }
      xhr.onerror = rej;
      if (xhr.upload && progressElem instanceof Element)
        xhr.upload.onprogress = function ({ loaded: l, total: t }) {
          let percent = `${Math.round((l / t) * 100)}%`;
          let progressbar = progressElem.querySelector("[aria-valuenow]");
          progressbar.style.width = percent;
          progressbar.textContent = percent;
        };
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
        "TOTP code",
        "Saisissez le code généré par l'application FreeOTP",
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
