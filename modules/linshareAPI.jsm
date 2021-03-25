var EXPORTED_SYMBOLS = ["LinshareAPI"];

var { FileUtils } = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { Preferences } = ChromeUtils.import("resource://gre/modules/Preferences.jsm");
var { PromptUtils } = ChromeUtils.import("resource://gre/modules/SharedPromptUtils.jsm");

var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var extension = ExtensionParent.GlobalManager.getExtension("linshare@linagora");
var { ROUTES } = ChromeUtils.import(extension.rootURI.resolve("modules/routes.js"));

var LinshareAPI = {
  CURRENT_COMPOSER() {
    return Services.wm.getMostRecentWindow("msgcompose");
  },
  async getPassword(SERVER_URL, USER_EMAIL, API_VERSION) {
    let win = this.CURRENT_COMPOSER();
    if (USER_EMAIL) {
      let args = {
        promptType: "promptPassword",
        title: "Credentials",
        text: `Enter your password for ${USER_EMAIL} account`,
        pass: "",
        checkLabel: "Remember me!",
        checked: false,
        ok: false,
      };
      let propBag = PromptUtils.objectToPropBag(args);
      await Services.ww.openWindow(
        win,
        "chrome://global/content/commonDialog.xhtml",
        "_blank",
        "centerscreen,chrome,modal,titlebar",
        propBag
      )
      PromptUtils.propBagToObject(propBag, args);

      let check = await this.checkCredentials(SERVER_URL, USER_EMAIL, API_VERSION, args.pass);
      if (args.ok && check.ok) {
        this.CURRENT_COMPOSER().credentials = { "hasPass": true, "pass": args.pass }
        if (args.checked) {
          var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
            Components.interfaces.nsILoginInfo,
            "init");
          var loginInfo = new nsLoginInfo(SERVER_URL, null, SERVER_URL, USER_EMAIL, args.pass, "", "");
          Services.logins.addLogin(loginInfo);
        }
        return args.pass;
      } else if (args.ok && !check.ok) {
        if (check.MESSAGE) Services.prompt.alert(win, 'Credentials', check.MESSAGE)
        Services.prompt.alert(win, 'Credentials', 'Something went wrong, Please check your credentials')
        return false
      } else {
        return false
      }
    } else {
      Services.prompt.alert(win, 'Credentials', 'Something went wrong, Please fill Linshare account acces')
      return false
    }
  },
  async getUserPassword(SERVER_URL, USER_EMAIL, API_VERSION) {
    let login = [];
    let logins = Services.logins.findLogins(SERVER_URL, null, SERVER_URL);
    if (logins != undefined && logins.length > 0) {
      login = logins.filter(login => login.username == USER_EMAIL)
    }
    let isTocken = Services.cookies.cookieExists(SERVER_URL, "/", "JSESSIONID", {})
    if (isTocken) return true
    if (login.length > 0) {
      return login[0].password
    }
    else if (this.CURRENT_COMPOSER().credentials && this.CURRENT_COMPOSER().credentials.hasPass) {
      return this.CURRENT_COMPOSER().credentials.pass
    } else {
      return await this.getPassword(SERVER_URL, USER_EMAIL, API_VERSION);
    }
  },
  async checkCredentials(SERVER_URL, USER_EMAIL, API_VERSION, password, code) {

    let url = `${SERVER_URL}${ROUTES.authentication[API_VERSION].url}`
    let authorization = btoa(`${USER_EMAIL}:${password}`)
    let headers = new Headers({
      "Authorization": `Basic ${authorization}`,
      "redirect": "error",
      "Content-Type": "application/json",
      "Accept": "application/json"
    })
    if (code) {
      headers.append("x-linShare-2fa-pin", code);
    }
    let response = await this._fetch(url, { "headers": this.makeRequestHeaders(headers, SERVER_URL) }, null)

    if (response.status == 200) {
      if (url.includes('version')) {
        let body = JSON.parse(response.body);
        let version = `v${body.version.charAt(0)}`;
        Preferences.set("linshare.API_VERSION", version);
      }
      if (response.headers.has('set-cookie')) {
        let cookie = response.headers.get('set-cookie').replace(" ", "").split(";");
        let tocken = cookie[0].split('=')
        Services.cookies.add(
          SERVER_URL,
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
        )
      }
      return { 'ok': true }
    } else if (response.headers.has("x-linshare-auth-error-code") && response.headers.get("x-linshare-auth-error-code") == "1002") {
      Preferences.set("linshare.API_VERSION", "v4");
      let code = this.needTOTPCode()
      if (!code) {
        return { 'ok': false }
      }
      return this.checkCredentials(SERVER_URL, USER_EMAIL, API_VERSION, password, code)
    } else if (response.headers.has("x-linshare-auth-error-msg")) {
      Preferences.set("linshare.API_VERSION", "v4");
      return { 'MESSAGE': response.headers.get("x-linshare-auth-error-msg"), 'ok': false };
    } else if (response.status == 404) {
      let nextVersion = API_VERSION
      if (API_VERSION === 'v4') {
        nextVersion = 'v1'
      } else {
        nextVersion = API_VERSION == 'v1' ? 'v2' : 'v4'
      }
      Preferences.set("linshare.API_VERSION", nextVersion);
      return this.checkCredentials(SERVER_URL, USER_EMAIL, nextVersion, password, code)
    } else if (response.status == 401 && response.headers.has('cookie')) {
      Services.cookie.removeCookiesFromExactHost(SERVER_URL, {})
    }

    return { 'ok': false }
  },
  async uploadFile(USER_INFOS, file, uploadProgress) {
    const SERVER_URL = USER_INFOS.SERVER_URL();
    const USER_EMAIL = USER_INFOS.USER_EMAIL();
    const API_VERSION = USER_INFOS.API_VERSION();

    let url = `${SERVER_URL}${ROUTES.uploadFileUrl[API_VERSION].url}`
    let type = `${ROUTES.uploadFileUrl[API_VERSION].ctype}`
    let pwd = await this.getUserPassword(SERVER_URL, USER_EMAIL, API_VERSION);
    if (!pwd) {
      return
    }
    let authorization = btoa(`${USER_EMAIL}:${pwd}`)

    let formData = new FormData()
    formData.append("filename", file.name)
    formData.append("file", file)
    formData.append("filesize", file.size)

    let headers = new Headers({
      "Authorization": `Basic ${authorization}`,
      "redirect": "manual",
      "Content-Type": "multipart/form-data"
    })

    if (type == 'application/json') {
      headers.append("Accept", "application/json")
    }
    let progressElem = uploadProgress()
    let response = await this._fetch(url, {
      method: 'POST',
      headers: this.makeRequestHeaders(headers, SERVER_URL),
      body: formData
    }, progressElem)

    let uuid;
    if (response.status === 200) {
      progressElem.querySelector('.progress-bar').classList.add("bg-success")
      uuid = this.handleResponse(response)
    } else if (response.status === 401) {
      let check = await this.checkCredentials(SERVER_URL, USER_EMAIL, API_VERSION, pwd)
      if (check.ok) {
        await this.uploadFile(USER_INFOS, file)
      } else if (!check.ok && check.MESSAGE) {
        Services.prompt.alert(this.CURRENT_COMPOSER(), 'Login Failed', check.MESSAGE)
      }
      return
    } else {
      progressElem.querySelector('.progress-bar').classList.add("bg-danger")
      uuid = await this.handleError(response)
    }
    return uuid
  },
  async shareMulipleDocuments(USER_INFOS, attachementsUuids, recipients, pathv2 = null) {
    const SERVER_URL = USER_INFOS.SERVER_URL();
    const USER_EMAIL = USER_INFOS.USER_EMAIL();
    const API_VERSION = USER_INFOS.API_VERSION()

    let path = pathv2 ? `${SERVER_URL}${pathv2}` : `${SERVER_URL}${ROUTES.multipleShareDocumentsUrl[API_VERSION].url}`
    let url = new URL(path)
    let type = `${ROUTES.multipleShareDocumentsUrl[API_VERSION].ctype}`
    let pwd = await this.getUserPassword(SERVER_URL, USER_EMAIL, API_VERSION);
    if (!pwd) {
      return
    }
    let authorization = btoa(`${USER_EMAIL}:${pwd}`)
    let requests;
    let version = API_VERSION.replace('v', '');
    if (version < 2) {
      requests = this.createRequestV1(SERVER_URL, url, attachementsUuids,
        recipients, authorization);
    } else {
      requests = this.createRequestV2(SERVER_URL, url, attachementsUuids,
        recipients, authorization);
    }
    for (let i = 0; i < requests.length; i++) {
      let response = await this._fetch(requests[i].url, requests[i].init, this.progress);
      if (response.status != 200 && response.status != 204) {
        let message = ""
        if (response.type == 'application/json') {
          let body = JSON.parse(response.body)
          if (body && body.message) {
            message = "with error message : "
            message += body.message
          }
        }
        return { ok: false, message }
      }
    };
    return { ok: true }
  },
  createRequestV1(SERVER_URL, url, attachementsUuids, recipients, authorization) {
    let requests = [];
    const urlParams = new URLSearchParams()
    for (let i = 0; i < attachementsUuids.length; i++) {
      if (i == 0) {
        urlParams.append('file', attachementsUuids[i])
      } else {
        urlParams.append('file' + i, attachementsUuids[i])
      }
    }
    let headers = new Headers({
      "Authorization": `Basic ${authorization}`,
      "redirect": "error",
      "Content-Type": "application/x-www-form-urlencoded",
      "Connection": "close"
    })
    for (let i = 0; i < recipients.length; i++) {
      urlParams.set('targetMail', recipients[i])
      let params = urlParams.toString()
      let init = {
        method: 'POST',
        headers: this.makeRequestHeaders(headers, SERVER_URL),
        params
      };
      requests.push({ url, init });
    }
    return requests;
  },
  createRequestV2(SERVER_URL, url, attachementsUuids, recipients, authorization) {
    let body = {
      "recipients": [],
      "documents": []
    }
    attachementsUuids.forEach(attachementsUuid => {
      body.documents.push(attachementsUuid);
    });
    recipients.forEach(recipient => {
      body.recipients.push({ "mail": recipient });
    });
    if (Preferences.get("linshare.ACCUSED_OF_SHARING")) {
      body = {
        ...body,
        "creationAcknoledgement": Preferences.get("linshare.ACCUSED_OF_SHARING")
      };
    }
    if (Preferences.get("linshare.SECURE_SHARE")) {
      body = {
        ...body,
        "secure": Preferences.get("linshare.SECURE_SHARE")
      };
    }
    if (Preferences.get("linshare.NO_DOWNLOAD")) {
      let d = new Date()
      d.setDate(d.getDate() + 15);
      body = {
        ...body,
        "expirationDate": d
      };
    }
    let headers = new Headers({
      "Authorization": `Basic ${authorization}`,
      "redirect": "error",
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Connection": "close"
    })

    let init = {
      method: 'POST',
      headers: this.makeRequestHeaders(headers, SERVER_URL),
      body: JSON.stringify(body)
    };
    return [{ url, init }];

  },
  handleResponse(response) {
    let contentType = response.type
    if (contentType.includes('application/json')) {
      return JSON.parse(response.body).uuid
    } else if (contentType.includes('application/xml')) {
      var oParser = new DOMParser();
      var text = oParser.parseFromString(response.body, "application/xml");
      return text.getElementsByTagName("uuid");
    }
  },
  async handleError(err) {
    switch (err.status) {
      case 420:
        Services.prompt.alert(this.CURRENT_COMPOSER(), "Error", "The account quota has been reached.")
        throw new Error("The account quota has been reached.")
      case 451:
        Services.prompt.alert(this.CURRENT_COMPOSER(), "Error", "File contains virus")
      default:
        if (JSON.parse(err.body).message) {
          Services.prompt.alert(this.CURRENT_COMPOSER(), "Error", JSON.parse(err.body).message)
          if (JSON.parse(err.body).errCode = "46011") {
            throw new Error(JSON.parse(err.body).message)
          }
        } else {
          Services.prompt.alert(this.CURRENT_COMPOSER(), "Error", "Uploading failed")
        }


    }
  },
  _fetch(url, opts = {}, progressElem = null) {
    return new Promise((res, rej) => {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'get', url);
      xhr.withCredentials = true;
      for (var pair of opts.headers.entries() || {}) {
        if (pair[0] == 'cookie') pair[0] = 'Cookie'
        xhr.setRequestHeader(pair[0], pair[1]);
      }
      xhr.onload = e => res({
        "type": e.target.getResponseHeader("Content-Type"),
        "body": e.target.response,
        "headers": this.makeResponseHeaders(e.target.getAllResponseHeaders()),
        "status": e.target.status,
      });
      if (progressElem) {
        this.CURRENT_COMPOSER().onclose = function (e) {
          e.stopPropagation()
          let confirm = Services.prompt.confirm(null, 'Abort uploading', 'Uploading to linshare is in process, do you want to stop it')
          if (confirm) {
            xhr.abort()
          } else {
            e.preventDefault()
          }
        }
      }
      xhr.onerror = rej;
      if (xhr.upload && progressElem instanceof Element)
        xhr.upload.onprogress = function ({ loaded: l, total: t }) {
          let percent = `${Math.round(l / t * 100)}%`
          let progressbar = progressElem.querySelector('[aria-valuenow]');
          progressbar.style.width = percent
          progressbar.textContent = percent
        };
      if (opts.body) {
        let body = opts.body
        xhr.send(body);
      } else if (opts.params) {
        let params = opts.params
        xhr.send(params)
      } else {
        xhr.send();
      }
    });
  },
  makeResponseHeaders(str) {
    let headers = str.match(/.*/g).
      filter(e => e).map(e => {
        return e.split(':')
      })
    return new Headers(Object.fromEntries(headers))
  },
  makeRequestHeaders(headers, serverUrl) {
    if (Services.cookies.cookieExists(serverUrl, "/", "JSESSIONID", {})) {
      let cookies = Services.cookies.getCookiesFromHost(serverUrl, {});
      let Cookie = `${cookies[cookies.length - 1].name}=${cookies[cookies.length - 1].value}`
      headers.append("Cookie", Cookie);
      headers.delete("authorization");
    }
    return headers;
  },
  async prefsTab(res) {
    let prefs = {};
    for (let i = 0; i < res.length; i++) {
      switch (res[i].identifier) {
        case "SECOND_FACTOR_AUTHENTICATION":
          prefs = { ...prefs, "2fa": res[i].enable };
          break;
        case "SHARE_CREATION_ACKNOWLEDGEMENT_FOR_OWNER":
          if (res[i].canOverride) {
            prefs = { ...prefs, "accusedOfSharingOverride": res[i].canOverride };
          }
          prefs = { ...prefs, "accusedOfSharing": res[i].enable };
          break;
        case "UNDOWNLOADED_SHARED_DOCUMENTS_ALERT":
          if (res[i].canOverride) {
            prefs = { ...prefs, "noDownloadOverride": res[i].canOverride };
          }
          prefs = { ...prefs, "noDownload": res[i].enable };
          break;
        case "UPLOAD_REQUEST__SECURED_URL":
          prefs = { ...prefs, "secureShare": res[i].enable };
          break;
      }
    }
    return prefs;
  },
  async isPrefsEnable(SERVER_URL, USER_EMAIL, API_VERSION) {
    let password = await this.getUserPassword(SERVER_URL, USER_EMAIL, API_VERSION);
    if (!password) {
      return
    }
    let url = `${SERVER_URL}${ROUTES.getFunctionalities[API_VERSION].url}`
    let authorization = btoa(`${USER_EMAIL}:${password}`)
    let response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${authorization}`,
        "redirect": "error",
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    })
    if (response.status == 200) {
      let res = await response.json();
      return await prefsTab(res)
    }
    return false;
  },
  needTOTPCode() {
    let code = {};
    let patern = new RegExp('^[0-9]{6}')
    let dialog;
    while (!(patern.test(code.value))) {
      dialog = Services.prompt.prompt(this.CURRENT_COMPOSER(), "TOTP code",
        "Saisissez le code généré par l'application FreeOTP", code, null, {
        value: false,
      });
      if (!dialog) {
        return false;
      }
    }
    return code.value;
  }
}


console.log('Loading LinshareAPI module');