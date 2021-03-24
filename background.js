if ("composeAction" in browser) {
  browser.composeAction.onClicked.addListener(async (tab) => {
    await sendToLinshare(tab).then(async (res) => { if (res.ok) { await notify(tab) } else { browser.linshare.prompt('alert', 'Something went wrong', res.message) } });
  });
}
if ("browserAction" in browser) {
  browser.browserAction.onClicked.addListener(async () => {
    browser.tabs.create({ url: browser.extension.getURL("content/views/options/options.html") });
  });
}


async function sendToLinshare(tab) {
  let attachments = await browser.compose.listAttachments(tab.id);
  let composeDetails = await browser.compose.getComposeDetails(tab.id);
  let recipients = composeDetails.to.concat(composeDetails.bcc).concat(composeDetails.cc)
  if (attachments.length < 1 || recipients.length < 1) {
    browser.linshare.prompt('alert', 'Empty field', 'At least one recipient and attachment are required')
    return
  }
  let files = [];
  for (let i = 0; i < attachments.length; i++) {
    let file = await attachments[i].getFile();
    files.push(file)
  }
  return await browser.linshare.sendAndShare(files, recipients);
}

async function notify(tab) {
  let userPrefs = await browser.linshare.getUserPrefs();
  let composeDetails = await browser.compose.getComposeDetails(tab.id);
  let parser = new DOMParser();
  let message = parser.parseFromString(composeDetails.body, "text/html")
  let hasMessage = false
  if(composeDetails.subject.trim().length == 0){
    browser.compose.setComposeDetails(tab.id, { 'subject': "Shared documents with Linshare" })
  }
  for (let elem of message.body.children) {
    if (elem.classList.contains('linshare-default-message')) {
      hasMessage = true
    }
  }
  if (!hasMessage) {
    let defaultMessaage = document.createElement('div');
    let separator = document.createElement('p')
    separator.innerHTML = '- - - - -'
    let defaultText = document.createElement('p')
    defaultText.innerText = userPrefs.MESSAGE;
    defaultMessaage.appendChild(separator);
    defaultMessaage.appendChild(defaultText);
    defaultMessaage.classList.add("linshare-default-message")
    message.body.append(defaultMessaage)
    browser.compose.setComposeDetails(tab.id, { 'body': message.body.innerHTML })
  }
  browser.linshare.sendMail();
}

