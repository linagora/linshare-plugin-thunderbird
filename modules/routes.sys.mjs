export const ROUTES = {
  // Order is used for fallback when testing version
  suportedBaseVersion: { v5: "v5", v4: "v4", v2: "v2" },
  uploadFileUrl: {
    v1: {
      ctype: "application/xml",
      url: "/webservice/rest/document/upload",
    },
    v2: {
      ctype: "application/json",
      url: "/webservice/rest/document/upload",
    },
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/documents",
    },
  },
  multipleShareDocumentsUrl: {
    v1: {
      ctype: "application/xml",
      url: "/webservice/rest/share/multiplesharedocuments",
    },
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/shares",
    },
  },
  APIVersion: {
    v1: {
      ctype: "application/xml",
      url: "/webservice/rest/plugin/information",
    },
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/authentication/version",
    },
  },
  authentication: {
    v1: {
      ctype: "application/xml",
      url: "/webservice/rest/plugin/information",
    },
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/authentication/authorized",
    },
  },
  getFunctionalities: {
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/functionalities",
    },
  },
  getSharedKey: {
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/authentication/2fa",
    },
  },
  quota: {
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/quota",
    },
  },
};
