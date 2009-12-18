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

var linshareConfig = {
  openPrefWindow: function() {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    var win = wm.getMostRecentWindow("linsharePreferences");
    if (win) {
      win.focus();
      win.getAttention();
    } else {
      var instantApply = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService)
                             .getBranch("browser.preferences.")
                             .getBoolPref("instantApply", false);
      var features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : "") + ",modal";
      window.openDialog("chrome://linshare/content/options.xul", "linsharePreferences", features);
    }
  },

  onMenuItemCommand: function(e) {
    linshareConfig.openPrefWindow();
  }
};
