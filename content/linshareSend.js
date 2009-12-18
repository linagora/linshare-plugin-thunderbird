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

var linshareSend = {
  onLoad: function() {
    this.url = window.arguments[0].url;
    this.email = window.arguments[0].email;
    this.password = window.arguments[0].password;
    this.bucket = window.arguments[0].bucket;
    this.recipients = window.arguments[0].recipients.value;

    this.callbackArg = window.arguments[1];

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

    // get file from url
    var ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var fileProtocolHandler = ioservice.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    var file = fileProtocolHandler.getFileFromURLSpec(attachment.url);
    
    const BOUNDARY="111222111";

    var multiStream = Components.classes["@mozilla.org/io/multiplex-input-stream;1"]
                                .createInstance(Components.interfaces.nsIMultiplexInputStream);
    var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                           .createInstance(Components.interfaces.nsIFileInputStream);
    stream.init(file, 0x01, 0444, null);
    var bufferStream = Components.classes["@mozilla.org/network/buffered-input-stream;1"]
                           .createInstance(Components.interfaces.nsIBufferedInputStream);
    bufferStream.init(stream, 4096);

    // get content type (maybe not necessary as LinShare seems to detect the right one)
    var contentType = "application/octet-stream";
    try {
      contentType = Components.classes["@mozilla.org/mime;1"]
                              .getService(Components.interfaces.nsIMIMEService)
                              .getTypeFromFile(file);
    } catch(e) {
      // use default one
    }

    // construct header
    var headerStream = Components.classes["@mozilla.org/io/string-input-stream;1"]
                                 .createInstance(Components.interfaces.nsIStringInputStream);
    var header = new String();
    header += "\r\n";
    header += "--" + BOUNDARY + "\r\n";
    //TODO: check file name encoding: using file.leafName is not sufficient
    header += "Content-disposition: form-data;name=\"file\";filename=\"" + attachment.name + "\"\r\n";
    header += "Content-Type: " + contentType + "\r\n";
    header += "Content-Length: " + file.fileSize + "\r\n\r\n";

    headerStream.setData(header, header.length);

    // construct footer
    var footerStream = Components.classes["@mozilla.org/io/string-input-stream;1"]
                                 .createInstance(Components.interfaces.nsIStringInputStream);
    var footer = new String("\r\n--"+BOUNDARY+"--\r\n");
    footerStream.setData(footer, footer.length);

    // send the whole stream
    multiStream.appendStream(headerStream);
    multiStream.appendStream(bufferStream);
    multiStream.appendStream(footerStream);

    var request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                            .createInstance(Components.interfaces.nsIXMLHttpRequest);
    request.open("POST", arg.url + "/documentrestservice/uploadfile", true, arg.email, arg.password);
    //TODO: it is impossible with 2.0 to catch 401 error (mozBackgroundRequest is not available)
    // So maybe we should change linShare not to return 401, or use only that to keep passwords
    // In fact this is a bug, see https://bugzilla.mozilla.org/show_bug.cgi?id=282547
    request.onreadystatechange = function (e) {
      if (request.readyState == 4)
        {
          if (document) {
            var progressMeter = document.getElementById("progressmeter");
            arg.current += file.fileSize * 100 / arg.max;
            progressMeter.value = arg.current;
          } else {
            //request has been canceled
            return;
          }
          if (request.status == 201) {
            arg.ids.push(request.responseXML.documentElement.getElementsByTagName("identifier")[0].textContent);
          } else {
            var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                          .getService(Components.interfaces.nsIPromptService);
            promptService.alert(window, arg.strings.getString("sendErrorTitle"),
                                arg.strings.getString("sendError") + " " + attachment.name);
          }
          arg.request = null;
          callback(arg);
        }
    };
    request.setRequestHeader("Content-Length", multiStream.available());
    request.setRequestHeader("Content-Type","multipart/form-data; boundary="+BOUNDARY);

    try {
      request.send(multiStream);
    } catch(e) {
            var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                          .getService(Components.interfaces.nsIPromptService);
            promptService.alert(window, arg.strings.getString("sendErrorTitle"),
                                arg.strings.getString("sendError") + " " + attachment.name);
            arg.cancel(arg);
    }
    arg.request = request;
  },

  _sendDocuments: function(arg) {
    var statusLabel = document.getElementById("status");
    statusLabel.value = arg.strings.getString("finalSendLabel");
    var progressMeter = document.getElementById("progressmeter");
    progressMeter.mode = "undetermined";

    if (arg.ids.length == 0) {
      arg.cancel(arg);
    }

    // request to send LinShare documents
    var fileParams;
    for (var i=0; i<arg.ids.length; i++) {
      if (i==0) {
        fileParams = "&file=" + arg.ids[i];
      } else {
        fileParams += "&file" + i + "=" + arg.ids[i];
      }
    }

    for (var recip=0; recip<arg.recipients.length; recip++) {
      var params = "targetMail="+arg.recipients[recip]+fileParams;
      var request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                            .createInstance(Components.interfaces.nsIXMLHttpRequest);
      request.open("POST", arg.url + "/sharerestservice/multiplesharedocuments", false, arg.email, arg.password);
      request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      request.setRequestHeader("Content-length", params.length);
      request.setRequestHeader("Connection", "close");
      request.send(params);
      if (request.status != 200) {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                      .getService(Components.interfaces.nsIPromptService);
        promptService.alert(window, arg.strings.getString("sendErrorTitle"),
                            arg.strings.getString("sendErrorRecipient") + " " + arg.recipients[recip]);
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
  }
};
