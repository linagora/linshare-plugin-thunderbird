export const ROUTES = {
  // Only modern v5 is supported as base version
  suportedBaseVersion: { v5: "v5" },
  uploadFileUrl: {
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/documents",
    },
  },
  multipleShareDocumentsUrl: {
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/shares",
    },
  },
  APIVersion: {
    base: {
      ctype: "application/json",
      url: "/webservice/rest/user/#base#/authentication/version",
    },
  },
  authentication: {
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
