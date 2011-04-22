//override the default SendMessage function from "MsgComposeCommands.js"
//SendMessage function gets called when you click the "Send" button
var SendMessageOriginal = SendMessage;
var SendMessage = function() {
  var strings = document.getElementById("linshare-option");
  var isActive = strings.getString("extensions.linshare.autoAttachmentWithLinshare.active");
  if(isActive == "true") {
    if(MySendMessage.sendingBigFileWithLinshare())
  	SendMessageOriginal.apply(this, arguments);  
  }
  else {
     SendMessageOriginal.apply(this, arguments);  
  }
  
};

//override the default SendMessageWithCheck function from "MsgComposeCommands.js"
//SendMessageWithCheck function gets called when you use a keyboard shortcut,
//such as Ctl-Enter (default), to send the message
var SendMessageWithCheckOriginal = SendMessageWithCheck;
var SendMessageWithCheck = function () {
  var strings = document.getElementById("linshare-option");
  var isActive = strings.getString("extensions.linshare.autoAttachmentWithLinshare.active");
  if(isActive == "true") {
    if(MySendMessage.sendingBigFileWithLinshare())
  	SendMessageWithCheckOriginal.apply(this, arguments);  
  }
  else {
     SendMessageWithCheckOriginal.apply(this, arguments);  
  }
};

var MySendMessage = {
  sendingBigFileWithLinshare: function() {
  try {
    var bucket=document.getElementById("attachmentBucket");
    var strings = document.getElementById("linshare-option");
    if(!bucket.hasChildNodes())
	return true;
    /*var max = 0;
    for (var i=0; i<this.bucket.childNodes.length; i++) {
      var file = fileProtocolHandler.getFileFromURLSpec(this.bucket.childNodes[i].attachment.url);
      max += file.fileSize;
    }*/
    prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService)
                    .getBranch("extensions.linshare.");
    prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
    if (prefs.prefHasUserValue("email")) {
  	email = prefs.getCharPref("email", "");
    } else {
  	email = null;
    }
    if (prefs.prefHasUserValue("url")) {
  	url = prefs.getCharPref("url", "");
    } else {
  	url = null;
    }
    message = prefs.getComplexValue("message", Components.interfaces.nsIPrefLocalizedString).data;
    if (!url) {
        linshareConfig.openPrefWindow();
    }
    password = getPassword(url, email);
    Recipients2CompFields(gMsgCompose.compFields);
    var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                       .getService(Components.interfaces.nsIMsgHeaderParser);
    var recipientsStr = gMsgCompose.compFields.to + "," + gMsgCompose.compFields.cc + "," + gMsgCompose.compFields.bcc;
    var recipients = {};
    var recipientsNbr = headerParser.parseHeadersWithArray(recipientsStr, recipients, {}, {});

    if (recipientsNbr == 0) {
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Components.interfaces.nsIPromptService);
      promptService.alert(window, strings.getString("noRecipientTitle"),
                          strings.getString("noRecipient"));
      return;
    }
    var ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var fileProtocolHandler = ioservice.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    var sum = 0;
    for (var i=0; i<bucket.childNodes.length; i++) {
      var file = fileProtocolHandler.getFileFromURLSpec(bucket.childNodes[i].attachment.url);
      sum += file.fileSize;
    }
    if(sum < (1024*parseInt(strings.getString("extensions.linshare.autoAttachmentMinimumInKB"))) )
      return true;
    _message = prefs.getComplexValue("message", Components.interfaces.nsIPrefLocalizedString).data;
    netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect'); 
    var features = "chrome,titlebar,toolbar,centerscreen,dialog,modal";
    window.openDialog("chrome://linshare/content/linshareSend.xul", "linshareSend",
                        features, {
                          url: url,
                          email: email,
                          password: password,
                          bucket: bucket,
                          recipients: recipients
                        },
    this);
    if(this.sendok){
       onSuccessSend(bucket,_message);	    
       return true;
    }
    else {
      event.preventDefault("compose-send-message");
      return false;
    }
    
  }
  catch (err) {
    return false;
  }
  
}
}
function onSuccessSend(bucket,_message) {
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
            myElement.innerHTML = _message;
            editor.document.body.insertBefore(myElement, signature);
          } else {
            editor.endOfDocument();
            editor.insertLineBreak();
            editor.insertText( _message );
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
            myElement.innerHTML = _message;
            editor.document.body.insertBefore(myElement, signature);
          } else {
            editor.endOfDocument();
            editor.insertHTML( "<p>"+_message+"</p>" );
          }
        }
        editor.endTransaction();
      } catch(ex) {
        Components.utils.reportError(ex);
        return false;
      }
      
}
function getPassword(url, email) {
    strings = document.getElementById("linshare-strings");
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
      var promptRet = prompts.promptPassword(window, strings.getString("passwordTitle"),
                                             strings.getString("passwordPrompt") + " " + email, input,
                                             strings.getString("passwordCheck"), mustSave);
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
