var EXPORTED_SYMBOLS = ["composerOverlay"]
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
function composerOverlay(sendingEvt, win) {

  let style = win.document.createElement("style");
  style.textContent = `
            
            #linshare-send-btn:before {
              content: "";
              display: -moz-box;
              background-image : url(chrome://linshare/content/linshare.png);
              background-repeat : no-repeat;
              background-size: contain;
              background-position : center;
              width:25px;
              height:20px;
            }
          `;
  win.document.documentElement.appendChild(style);

  let composeTlbar = win.document.querySelector("#composeToolbar2")
  let linshareBtn = win.document.createXULElement("toolbarbutton")

  linshareBtn.class = "toolbarbutton-1"
  linshareBtn.id = "linshare-send-btn"
  linshareBtn.label = "Send&Share"
  linshareBtn.tooltiptext = "Send attachement by LinShare"
  linshareBtn.onclick = function () {
    console.log("Sending by linshare")
    let winId = win.windowUtils.currentInnerWindowID
    sendingEvt(winId)
  }
  let tbDefaultset = composeTlbar.getAttribute("defaultset")
  let newTbDefaultset = `linshare-send-btn,spacer,${tbDefaultset}`
  composeTlbar.setAttribute('defaultset', 'spacer', newTbDefaultset)

  if (composeTlbar) {
    composeTlbar.insertBefore(linshareBtn, composeTlbar.childNodes[1])
  }


}
