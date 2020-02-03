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

var linshare = {
  onLoad: function() {
    // initialization code
    this.initialized = true;

    // localization
    this.strings = document.getElementById("linshare-strings");

    // preferences
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService)
                    .getBranch("extensions.linshare.");
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch);
    if (this.prefs.prefHasUserValue("email")) {
      this._email = this.prefs.getCharPref("email", "");
    } else {
      this._email = null;
    }
    if (this.prefs.prefHasUserValue("url")) {
      this._url = this.prefs.getCharPref("url", "");
    } else {
      this._url = null;
    }
    this._message = this.prefs.getComplexValue("message", Components.interfaces.nsIPrefLocalizedString).data;

    // preferences observer
    this.prefs.addObserver("", this, false);

  },

  onUnLoad: function() {
    if (!this.prefs) {
      this.prefs.removeObserver("", this);
    }
  },

  observe: function(aSubject, aTopic, aData) {
    if(aTopic != "nsPref:changed") return;
    switch (aData) {
      case "email":
        if (this.prefs.prefHasUserValue("email")) {
          this._email = this.prefs.getCharPref("email", "");
        } else {
          this._email = null;
        }
        break;
      case "url":
        if (this.prefs.prefHasUserValue("url")) {
          this._url = this.prefs.getCharPref("url", "");
        } else {
          this._url = null;
        }
        break;
      case "message":
        this._message = this.prefs.getComplexValue("message", Components.interfaces.nsIPrefLocalizedString).data;
    }
  },

  onToolbarButtonCommand: function(e) {
    // Open configuration dialog if it is not configured
    if (!this._url) {
      linshareConfig.openPrefWindow();
    }

    var bucket=document.getElementById("attachmentBucket");

    //TODO: previously use TBird api to check mail?
    // this could allow not to have to check number of recipients, etc.

    // Get recipients
    Recipients2CompFields(gMsgCompose.compFields);
    var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                       .getService(Components.interfaces.nsIMsgHeaderParser);
    var recipientsStr = gMsgCompose.compFields.to + "," + gMsgCompose.compFields.cc + "," + gMsgCompose.compFields.bcc;
    var recipients = {};
    var recipientsNbr = headerParser.parseHeadersWithArray(recipientsStr, recipients, {}, {});

    if (recipientsNbr == 0) {
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Components.interfaces.nsIPromptService);
      promptService.alert(window, this.strings.getString("noRecipientTitle"),
                          this.strings.getString("noRecipient"));
      return;
    }

    var onSuccessSend = function(arg) {
      //TODO: remove only sent attachments?
      while (bucket.hasChildNodes()) {
        bucket.removeChild(bucket.lastChild);
      }
      // append some text in body
      //TODO: don't append text if it has already been
      try {
        var editor = GetCurrentEditor();
        var editor_type = GetCurrentEditorType();
        editor.beginTransaction();
        if( editor_type == "textmail" || editor_type == "text" ) {
          // Try to find signature
          var signature = null;
          if (editor.document.body && editor.document.body.childNodes) {
            var nodes = editor.document.body.childNodes;
            for (var i=0; i<nodes.length; i++) {
              if (nodes[i].nodeValue == "-- ") {
                signature = nodes[i];
                // no break; as we want the last one
              }
            }
          }
          if (signature) {
            var myElement = editor.document.createElement("p");
            myElement.innerHTML = arg._message;
            editor.document.body.insertBefore(myElement, signature);
          } else {
            editor.endOfDocument();
            editor.insertLineBreak();
            editor.insertText( arg._message );
            editor.insertLineBreak();
          }
        } else {
          // Try to find signature
          var signature = null;
          if (editor.document.body && editor.document.body.childNodes) {
            var nodes = editor.document.body.childNodes;
            for (var i=0; i<nodes.length; i++) {
              if (nodes[i].nodeName == "PRE") {
                signature = nodes[i];
                // no break; as we want the last one
              }
            }
          }
          if (signature) {
            var myElement = editor.document.createElement("p");
            myElement.innerHTML = arg._message;
            editor.document.body.insertBefore(myElement, signature);
          } else {
            editor.endOfDocument();
            editor.insertHTML( "<p>"+arg._message+"</p>" );
          }
        }
        editor.endTransaction();
      } catch(ex) {
        Components.utils.reportError(ex);
        return false;
      }
      GenericSendMessage(document.gIsOffLine ? Components.interfaces.nsIMsgCompDeliverMode.Later : Components.interfaces.nsIMsgCompDeliverMode.Now);
    };

    var onCancelSend = function(arg) {
      return;
    };

    if (bucket.hasChildNodes()) {
      this._password = this._getPassword(this._url, this._email);
      var features = "chrome,titlebar,toolbar,centerscreen,dialog,modal";
      window.openDialog("chrome://linshare/content/linshareSend.xul", "linshareSend",
                        features, {
                          url: this._url,
                          email: this._email,
                          password: this._password,
                          bucket: bucket,
                          recipients: recipients
                        },
                        this);
      if (this.sendok) {
        onSuccessSend(this);
      } else {
        onCancelSend(this);
      }
    } else {
      GenericSendMessage(document.gIsOffLine ? Components.interfaces.nsIMsgCompDeliverMode.Later :Components.interfaces.nsIMsgCompDeliverMode.Now);
    }
  },

  _getPassword: function(url, email) {
    var password = null;
    // Get password in "session"
    var hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
         .getService(Components.interfaces.nsIAppShellService)
         .hiddenDOMWindow;
    if (hiddenWindow) {
      if (hiddenWindow.linshareUrl && hiddenWindow.linshareEmail && hiddenWindow.linsharePassword) {
        if (hiddenWindow.linshareUrl == url &&
            hiddenWindow.linshareEmail == email) {
          password = hiddenWindow.linsharePassword;
        }
      }
    }

    // Else get password in Password Manager
    if (!password) {
      var passwordManager = null;
      var loginManager = null;
      if ("@mozilla.org/passwordmanager;1" in Components.classes) { // TB 2.0
        passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                    .getService(Components.interfaces.nsIPasswordManager);
        var passwords = passwordManager.enumerator;
        while (passwords.hasMoreElements()) {
          try {
            var pass = passwords.getNext().QueryInterface(Components.interfaces.nsIPassword);
            if (pass.host == url && pass.user == email) {
                 password = pass.password;
                 break;
            }
          } catch (e) {}
        }
      } else {  // TB 3
        loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                 .getService(Components.interfaces.nsILoginManager);
        var logins = loginManager.findLogins({}, url, url, null);
        for (var i = 0; i < logins.length; i++) {
          if (logins[i].username == email) {
           password = logins[i].password;
           break;
          }
        }
      }
    }

    // Else prompt for password
    if (!password) {
      var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                          .getService(Components.interfaces.nsIPromptService);
      var input = {value: ""};
      var mustSave = {value: false};
      var promptRet = prompts.promptPassword(window, this.strings.getString("passwordTitle"),
                                             this.strings.getString("passwordPrompt") + " " + email, input,
                                             this.strings.getString("passwordCheck"), mustSave);
      if (!promptRet) {
        return null;
      }

      password = input.value;

      //TODO: should save only if successful
      if (mustSave.value) {
        if (passwordManager) { // TB 2.0
          passwordManager.addUser(url, email, password);
        } else { // TB 3
          var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                             Components.interfaces.nsILoginInfo,
                                             "init");
          var loginInfo = new nsLoginInfo(url, url, null, email, password, "", "");
          loginManager.addLogin(loginInfo);
        }
      } else {
        hiddenWindow.linshareUrl = url;
        hiddenWindow.linshareEmail = email;
        hiddenWindow.linsharePassword = password;
      }
    }
    return password;

  }

};
window.addEventListener("load", function(e) { linshare.onLoad(e); }, false);
window.addEventListener("unload", function(e) { linshare.onUnLoad(e); }, false);
