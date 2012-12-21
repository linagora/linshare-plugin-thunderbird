/*  Linshare extension for Thunderbird: send attachments with LinShare
    http://www.linpki.org/ 
    Copyright (C) 2009 Linagora <raphael.ouazana@linagora.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var DEFAULT_SERVER_API_VERSION = 1;

var linshareSend = {
  onLoad: function() {
    this.url = window.arguments[0].url;
    this.email = window.arguments[0].email;
    this.password = window.arguments[0].password;
    this.bucket = window.arguments[0].bucket;
    this.recipients = window.arguments[0].recipients.value;
    this.prefs = Components
                    .classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService)
                    .getBranch("extensions.linshare.")
                    .QueryInterface(Components.interfaces.nsIPrefBranch2);
    this.scriptLoader = Components
                            .classes["@mozilla.org/moz/jssubscript-loader;1"]
                            .createInstance(Components.interfaces.mozIJSSubScriptLoader);

    this.callbackArg = window.arguments[1];
    
    this.serverAPI = this.loadServerAPIImplementation();

    this.ids = new Array();
    this.currentAttachment = 0;

    this.strings = document.getElementById("linshare-strings");

    // Initialize progress meter
    var ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var fileProtocolHandler = ioservice.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    var max = 0;
    for (var i=0; i<this.bucket.childNodes.length; i++) {
      var file = fileProtocolHandler.getFileFromURLSpec(this.bucket.childNodes[i].attachment.url);
      max += file.fileSize;
    }
    this.max = max;
    this.current = 0;

    this._createDocument(this.bucket.childNodes[this.currentAttachment].attachment, this._createDocumentCB, this);
  },
  
  loadServerAPIImplementation: function () {
      var version = this.serverAPIVersion;
      
      switch (version) {
          case 1:
              if ( typeof(LinshareServerAPIv1) == "undefined" ) {
                  this.scriptLoader.loadSubScript("chrome://linshare/content/server/linshareServerAPIv1.js");
              }
              return new LinshareServerAPIv1();
              
              break;
          case 2:
              if ( typeof(LinshareServerAPIv2) == "undefined" ) {
                  this.scriptLoader.loadSubScript("chrome://linshare/content/server/linshareServerAPIv2.js");
              }
              return new LinshareServerAPIv2();
              
              break;
          default:
              throw "Unsupported server API version '" + version + "'";
      }
  },
  
  get serverInfo() {
      return {
          url: this.url,
          username: this.email,
          password: this.password
      };
  },
  
  get serverAPIVersion() {
      try {
          return this.prefs.getIntPref("server.api.version");
      } catch (e) {
          return DEFAULT_SERVER_API_VERSION;
      }
  },

  _createDocumentCB: function(arg) {
    arg.currentAttachment++;
    if (arg.currentAttachment >= arg.bucket.childNodes.length) {
      arg._sendDocuments(arg);
    } else {
      arg._createDocument(arg.bucket.childNodes[arg.currentAttachment].attachment, arg._createDocumentCB, arg);
    }
  },

  _createDocument: function(attachment, callback, arg) {
    var statusLabel = document.getElementById("status");
    statusLabel.value = arg.strings.getString("sendLabel") + " " + attachment.name;

    arg.request = this.serverAPI.uploadFile(this.serverInfo, attachment, {
        error: function (status, e) {
            switch (status) {
                case 420:
                    linshareSend.showError(arg, "sendErrorQuota", attachment.name, true);
                    break;
                case 451:
                    linshareSend.showError(arg, "sendErrorVirus", attachment.name, true);
                    break;
                // In this case the error could be anything, including a network issue
                // We check whether we should use the alternate API (in case the server was upgraded)
                default:
                    if (linshareSend.serverAPI.shouldSwitchVersion(linshareSend.serverInfo)) {
                        linshareSend.prefs.setIntPref("server.api.version", linshareSend.serverAPI.nextVersion());
                        linshareSend.serverAPI = linshareSend.loadServerAPIImplementation();
                        
                        // This will retry the request with the upgraded API
                        linshareSend._createDocument(attachment, callback, arg);
                    } else {
                        linshareSend.showError(arg, "sendError", attachment.name, true);
                    }
            }
        },
        success: function (id, file) {
            if (document) {
                var progressMeter = document.getElementById("progressmeter");
                arg.current += file.fileSize * 100 / arg.max;
                progressMeter.value = arg.current;
            } else {
                //request has been canceled
                return;
            }
            
            arg.ids.push(id);
            arg.request = null;
            callback(arg);
        }
    });
  },

  _sendDocuments: function(arg) {
    var statusLabel = document.getElementById("status");
    statusLabel.value = arg.strings.getString("finalSendLabel");
    var progressMeter = document.getElementById("progressmeter");
    progressMeter.mode = "undetermined";

    if (arg.ids.length == 0) {
      arg.cancel(arg);
    }

    for (var i = 0; i < arg.recipients.length; i++) {
        var recipient = arg.recipients[i];
        
        if (!this.serverAPI.shareMultipleFiles(this.serverInfo, arg.ids, recipient)) {
            this.showError(arg, "sendErrorRecipient", recipient, false);
        }
    }
    
    arg.callbackArg.sendok = true;
    window.setTimeout('window.close();',100);  
  },

  cancel: function(arg) {
    if (arg.request != null) {
      arg.request.abort();
    }
    arg.callbackArg.sendok = false;
    window.setTimeout('window.close();',100);  
  },
  
  showError: function (arg, code, message, cancel) {
      var promptService = Components
                              .classes["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Components.interfaces.nsIPromptService);
      
      promptService.alert(window, arg.strings.getString("sendErrorTitle"), arg.strings.getString(code) + " " + message);
      
      if (cancel) {
          arg.cancel(arg);
          // don't propagate the event compose-send-message, ie: send the message
          event.preventDefault("compose-send-message");
      }
  }
};
