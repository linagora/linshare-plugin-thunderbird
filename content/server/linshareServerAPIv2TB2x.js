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

function linshareServerAPIv2TB2x() {
	this.logInfo("using api : linshareServerAPIv2TB2x");
}


linshareServerAPIv2TB2x.prototype = {
    __proto__: new LinshareServerAPIBase(),
    

    uploadFileUrl: function (url) {
        return url + "/webservice/rest/document/upload";
    },
    
    multipleShareDocumentsUrl: function (url) {
        return url + "/webservice/rest/share/multiplesharedocuments";
    },



    uploadFile: function (serverInfo, attachment, callback) {        
        var file = this.openFile(attachment.url);
        var request = this.newFileUploadRequest(file, attachment.name, this.uploadFileUrl(serverInfo.url), true, serverInfo.username, serverInfo.password);
        
	this.logInfo('uploading a file : ' + attachment.name);
        request.setRequestHeader("Accept", "application/json");
        request.onreadystatechange = function (e) {
            if (request.readyState == 4) {
                if (request.status == 200) {
                    try {
//			request.logInfo('request attributes :');
//			for(var propertyName in request) {
//				request.logInfo(propertyName);
//				request.logInfo(request[propertyName]);
//			}
			request.logInfo(request.responseText);
			// JSON object is not supported by Thunderbird 2.
			var uuid;
			var resp = request.responseText.replace('\{','').replace('\}','');
			var tab1 = resp.split('\,');
		        for (var i=0; i < tab1.length; i++) {
				var tab2 = tab1[i].split(':');
				if (tab2[0] == '"uuid"') {
				        var regEx = new RegExp('(")', "gi");
					uuid = tab2[1].replace(regEx , "");
					break;
				}
			}
			request.logInfo("uploaded doc uuid : " + uuid)
                        callback.success(uuid, file);
			
                    } catch(e) {
			request.logError('error parsing request result : ' + e );
                        callback.error(request.status, e);
                    }
                } else {
		    request.logError('request failed, errCode : ' + request.status);
                    callback.error(request.status);
                }
            }
        };

        try {
            request.sendFile();
        } catch(e) {
            this.logError('request failed ' + e);
            callback.error(-1, e);
        }
        
        return request;
    },
    
    shareMultipleFiles: function (serverInfo, fileIds, recipient) {
        var fileParams = "";
        
        for (var i=0; i < fileIds.length; i++) {
            fileParams += "&file=" + fileIds[i];
        }


        var params = "targetMail=" + recipient + fileParams;
        var request = this.newRequest("POST", this.multipleShareDocumentsUrl(serverInfo.url), false, serverInfo.username, serverInfo.password);
        
        request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        request.setRequestHeader("Content-length", params.length);
        request.setRequestHeader("Connection", "close");
        request.send(params);
        
        return request.status == 204;
    }
};
