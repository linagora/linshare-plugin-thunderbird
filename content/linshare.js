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
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
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

    // add a toolbar button if necessary
    if (document.getElementById("linshare-toolbar-button") == null) {
      var sendButton = document.getElementById("button-send");
      var toolbar = document.getElementById("composeToolbar");
      if (toolbar == null) {
        toolbar = document.getElementById("composeToolbar2");
      }
      // get toolbar element that is just after sendButton
      var child = toolbar.firstChild;
      var sendButtonNext = null;
      while (child) {
        if (child.id == "button-send") {
          if (child.nextSibling) {
            sendButtonNext = document.getElementById(child.nextSibling.id);
          }
          break;
        }
        child = child.nextSibling;
      }
      if (sendButton != null && toolbar != null) {
        if (sendButtonNext) {
          toolbar.insertItem("linshare-toolbar-button", sendButtonNext, null, false);
        } else {
          toolbar.insertItem("linshare-toolbar-button", sendButton, null, false);
        }
        document.persist(toolbar.id, "currentset");
      }
    }
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
      var features = "chrome,titlebar,centerscreen,modal";
      window.openDialog("chrome://linshare/content/options.xul", "Preferences", features);
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
      if (!arg.messageAlreadyAdded) {
        try {  
          var editor = GetCurrentEditor();  
          var editor_type = GetCurrentEditorType();  
          editor.beginTransaction();  
          editor.endOfDocument(); // seek to end 
          if( editor_type == "textmail" || editor_type == "text" ) {  
            editor.insertText( arg._message );  
            editor.insertLineBreak();  
          } else {  
            editor.insertHTML( "<p>"+arg._message+"</p>" );  
          }  
          editor.endTransaction();
          arg.messageAlreadyAdded = true; 
        } catch(ex) {  
          Components.utils.reportError(ex);  
          return false;
        }
      }
      GenericSendMessage(document.gIsOffLine ? nsIMsgCompDeliverMode.Later : nsIMsgCompDeliverMode.Now);
      arg.messageAlreadyAdded = false;
    };

    var onCancelSend = function(arg) {
      return;
    };

    if (bucket.hasChildNodes()) {
      //TODO: make it modal?
      window.openDialog("chrome://linshare/content/linshareSend.xul", "linshareSend",
                        "chrome,centerscreen,titlebar", {
                          url: this._url,
                          email: this._email,
                          bucket: bucket,
                          recipients: recipients
                        },
                        onSuccessSend,
                        onCancelSend,
                        this);
    } else {
      GenericSendMessage(document.gIsOffLine ? nsIMsgCompDeliverMode.Later : nsIMsgCompDeliverMode.Now);
    }
  }

};
window.addEventListener("load", function(e) { linshare.onLoad(e); }, false);
window.addEventListener("unload", function(e) { linshare.onUnLoad(e); }, false);
