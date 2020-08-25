var EXPORTED_SYMBOLS = ["ROUTES"];

const ROUTES = {
  "uploadFileUrl": {
    "v1": {
      "ctype": "application/xml",
      "url": "/documentrestservice/uploadfile"
    },
    "v2": {
      "ctype": "application/json",
      "url": "/webservice/rest/document/upload"
    },
    "v4": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v4/documents"
    }
  },
  "multipleShareDocumentsUrl": {
    "v1": {
      "ctype": "application/xml",
      "url": "/sharerestservice/multiplesharedocuments"
    },
    "v2": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v2/shares"
    },
    "v4": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v4/shares"
    }
  },
  "authentication": {
    "v1": {
      "ctype": "application/xml",
      "url": "/servicerestuserauthentication/authorized"
    },
    "v2": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v2/authentication/version"
    },
    "v4": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v4/authentication/version"
    }
  },
  "apiVersion": {
    "url": "/webservice/rest/user/v2/authentication/version"
  },
  "getFunctionalities": {
    "v4": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v2/functionalities"
    }
  },
  "getSharedKey": {
    "v4": {
      "ctype": "application/json",
      "url": "/webservice/rest/user/v4/authentication/2fa/"
    }
  }
}