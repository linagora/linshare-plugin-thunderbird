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

function LinshareServerAPIBase() {
}

LinshareServerAPIBase.prototype = {
    BOUNDARY: "111222111",
        
    mIOService: Components
                    .classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService),
                    
    mMimeService: Components
                    .classes["@mozilla.org/mime;1"]
                    .getService(Components.interfaces.nsIMIMEService),
                    
    newRequest: function (method, url, async, username, password) {
        var request =  Components
                            .classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                            .createInstance(Components.interfaces.nsIXMLHttpRequest);
        
        request.open(method, this.removeSlashes(url), async, username, password);
        
        return request;
    },
    
    newFileUploadRequest: function (file, fileName, url, async, username, password) {
        var contentType = this.getFileMimeType(file, "application/octet-stream");
        var multiStream = Components
                            .classes["@mozilla.org/io/multiplex-input-stream;1"]
                            .createInstance(Components.interfaces.nsIMultiplexInputStream);
        var header = "\r\n--" + this.BOUNDARY + "\r\n";
        var request = this.newRequest("POST", url, async, username, password);
        
        //TODO: check file name encoding: using file.leafName is not sufficient
        // Bug #139 Adding unescape(encodeURIComponent fixed the bug
        // Only works with Linshare >= 0.8.4
        header += "Content-disposition: form-data;name=\"file\";filename=\"" + unescape(encodeURIComponent(fileName))  + "\"\r\n";
        header += "Content-Type: " + contentType + "; charset=UTF-8 \r\n";
        header += "Content-Length: " + file.fileSize + "\r\n\r\n";

        multiStream.appendStream(this.newStringInputStream(header));
        multiStream.appendStream(this.newBufferedFileInputStream(file));
        multiStream.appendStream(this.newStringInputStream("\r\n--" + this.BOUNDARY + "--\r\n"));

        request.setRequestHeader("Content-Length", multiStream.available());
        request.setRequestHeader("Content-Type","multipart/form-data; boundary=" + this.BOUNDARY);
        
        // A small utility function allowing us to hide the complexity of the multiStream object
        request.sendFile = function () {
            this.send(multiStream);
        };
        
        return request;
    },
    
    removeSlashes: function (url) {
        var slash = "/";
        var regEx = new RegExp("(" + slash + "){2,}", "i");
        
	// removing double '/'
        newUrl = url.replace(regEx, slash);
	// removing last '/'
	return newUrl.replace(/\/$/,'');
    },
    
    openFile: function (url) {
        return this.mIOService
                        .getProtocolHandler("file")
                        .QueryInterface(Components.interfaces.nsIFileProtocolHandler)
                        .getFileFromURLSpec(url);
    },
    
    getFileMimeType: function (file, defaultType) {
        try {
            return this.mMimeService.getTypeFromFile(file);
        } catch (e) {
            return defaultType;
        }
    },
    
    newStringInputStream: function (data) {
        var stream = Components
                        .classes["@mozilla.org/io/string-input-stream;1"]
                        .createInstance(Components.interfaces.nsIStringInputStream);
        
        stream.setData(data, data.length);
        
        return stream;
    },
    
    newBufferedFileInputStream: function (file) {
        var stream = Components
                        .classes["@mozilla.org/network/file-input-stream;1"]
                        .createInstance(Components.interfaces.nsIFileInputStream);
        var bufferedStream = Components
                                .classes["@mozilla.org/network/buffered-input-stream;1"]
                                .createInstance(Components.interfaces.nsIBufferedInputStream);

        stream.init(file, 0x01, 0444, null);
        bufferedStream.init(stream, 4096);
        
        return bufferedStream;
    },
    
    // Server API methods
    
    uploadFile: function (serverInfo, attachment, callback) {
    },
    
    shareMultipleFiles: function (serverInfo, fileIdentifiers, recipient) {
    },
    
    shouldSwitchVersion: function (serverInfo) {
        return false;
    },
    
    nextVersion: function () {
    }
};
