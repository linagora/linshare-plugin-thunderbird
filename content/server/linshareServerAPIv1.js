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

if ( typeof(LinshareServerAPIBase) == "undefined" ) {
    var scriptLoader = Components
                            .classes["@mozilla.org/moz/jssubscript-loader;1"]
                            .createInstance(Components.interfaces.mozIJSSubScriptLoader);
    
    scriptLoader.loadSubScript("chrome://linshare/content/server/linshareServerAPIBase.js");
}

function LinshareServerAPIv1() {
}

LinshareServerAPIv1.prototype = {
    __proto__: new LinshareServerAPIBase(),
    
    uploadFileUrl: function (url) {
        return url + "/documentrestservice/uploadfile";
    },
    
    multipleShareDocumentsUrl: function (url) {
        return url + "/sharerestservice/multiplesharedocuments";
    },
    
    pluginInfoUrl: function (url) {
        return url + "/webservice/rest/plugin/information";
    },
    
    uploadFile: function (serverInfo, attachment, callback) {        
        var file = this.openFile(attachment.url);
        var request = this.newFileUploadRequest(file, attachment.name, this.uploadFileUrl(serverInfo.url), true, serverInfo.username, serverInfo.password);
        
        //TODO: it is impossible with 2.0 to catch 401 error (mozBackgroundRequest is not available)
        // So maybe we should change linShare not to return 401, or use only that to keep passwords
        // In fact this is a bug, see https://bugzilla.mozilla.org/show_bug.cgi?id=282547
        request.onreadystatechange = function (e) {
            if (request.readyState == 4) {
                if (request.status == 201) {
                    // If the xml response is incorrect then display an error message and abort
                    try {
                        var doc = request.responseXML.documentElement;
                        var id = doc.getElementsByTagName("identifier")[0].textContent;
                        
                        callback.success(id, file);
                    } catch(e) {
                        callback.error(request.status, e);
                    }
                } else {
                    callback.error(request.status);
                }
            }
        };

        try {
            request.sendFile();
        } catch(e) {
            callback.error(-1, e);
        }
        
        return request;
    },
    
    shareMultipleFiles: function (serverInfo, fileIds, recipient) {
        var fileParams = "";
        
        for (var i=0; i < fileIds.length; i++) {
            if (i==0) {
                fileParams = "&file=" + fileIds[i];
            } else {
                fileParams += "&file" + i + "=" + fileIds[i];
            }
        }

        var params = "targetMail=" + recipient + fileParams;
        var request = this.newRequest("POST", this.multipleShareDocumentsUrl(serverInfo.url), false, serverInfo.username, serverInfo.password);
        
        request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        request.setRequestHeader("Content-length", params.length);
        request.setRequestHeader("Connection", "close");
        request.send(params);
        
        return request.status == 200;
    },
    
    shouldSwitchVersion: function (serverInfo) {
        var request = this.newRequest("GET", this.pluginInfoUrl(serverInfo.url), false, serverInfo.username, serverInfo.password);
        
        request.setRequestHeader("Accept", "application/json");
        request.send(null); // No parameters
        
        return request.status == 200;
    },
    
    nextVersion: function () {
        return 2;
    }
};