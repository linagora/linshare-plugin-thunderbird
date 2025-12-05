console.log("LinShare Background Script - Initialization for Thunderbird 140");

// Test immédiat des APIs disponibles
console.log("Available APIs:", Object.keys(browser));
console.log("browserAction available:", !!browser.browserAction);
console.log("runtime available:", !!browser.runtime);

// Configuration IMMÉDIATE et STABLE du browserAction
console.log("Configuring Manage button...");
try {
  browser.browserAction.onClicked.addListener(async () => {
    console.log("Manage button clicked");
    try {
      const url = browser.runtime.getURL("content/views/options/options.html");
      console.log("Opening:", url);
      await browser.tabs.create({ url });
    } catch (error) {
      console.error("Error opening options:", error);
    }
  });
  console.log("Manage button configured successfully");
} catch (error) {
  console.error("Error configuring browserAction:", error);
}

// Vérifier que l'icône du browserAction est définie
try {
  browser.browserAction.setIcon({ path: "assets/linshare.png" });
  browser.browserAction.setTitle({ title: "LinShare - Gérer" });
  console.log("browserAction icon and title set");
} catch (error) {
  console.warn("Could not set icon/title:", error);
}

// Configuration du composeAction pour "Envoyer via LinShare"  
console.log("Configuring Send via LinShare button...");
// Configuration du composeAction pour "Envoyer via LinShare"
console.log("Configuring Send via LinShare button...");
if (browser.composeAction) {
  browser.composeAction.onClicked.addListener(async (tab) => {
    console.log("Send via LinShare button clicked for tab:", tab.id);
    try {
      await sendToLinshare(tab).then(async (result) => {
        if (result && result.success) {
          // Success - files uploaded
          await notify(tab, result);
        } else if (result) {
          // Error message
          browser.linshareExtAPI.prompt("alert", "Something went wrong", result);
        }
      });
    } catch (error) {
      console.error("Global error:", error);
      browser.linshareExtAPI.prompt("alert", "Erreur", error.message);
    }
  });
}



async function sendToLinshare(tab) {
  let attachments = await browser.compose.listAttachments(tab.id);
  let composeDetails = await browser.compose.getComposeDetails(tab.id);
  let recipients = composeDetails.to.concat(composeDetails.bcc || []).concat(composeDetails.cc || []);

  if (attachments.length < 1 || recipients.length < 1) {
    browser.linshareExtAPI.prompt(
      "alert",
      "Empty field",
      "At least one recipient and attachment are required"
    );
    return "Validation failed";
  }

  let files = [];
  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];

    try {
      // Use the proper Thunderbird API to get file content (available since TB 98)
      console.log(`Getting file content for: ${attachment.name} (ID: ${attachment.id})`);

      const file = await browser.compose.getAttachmentFile(attachment.id);
      files.push(file);

      console.log(`File prepared: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    } catch (error) {
      console.error(`Error getting file ${attachment.name}:`, error);
      return `Error getting file: ${error.message}`;
    }
  }

  if (browser.linshareExtAPI) {
    // Retrieve settings from storage
    let settings = null;
    try {
      const data = await browser.storage.local.get("linshareUserInfos");
      if (data && data.linshareUserInfos) {
        settings = data.linshareUserInfos;
        console.log("Settings retrieved from storage for upload");
      } else {
        console.warn("No settings found in storage");
      }
    } catch (e) {
      console.error("Error retrieving settings from storage:", e);
    }

    const result = await browser.linshareExtAPI.sendAndShare(files, recipients, settings);

    if (!result) {
      // Success - remove attachments and return file info
      console.log("Upload successful, removing attachments...");

      for (let attachment of attachments) {
        try {
          await browser.compose.removeAttachment(tab.id, attachment.id);
          console.log("Attachment removed:", attachment.name);
        } catch (error) {
          console.warn("Failed to remove attachment:", attachment.name, error);
        }
      }

      // Return file names for link generation
      return { success: true, files: files.map(f => f.name) };
    }

    return result; // Error message
  } else {
    console.error("browser.linshareExtAPI is undefined");
    throw new Error("LinShare API not available");
  }
}

async function notify(tab, uploadResult) {
  console.log("notify called for tab:", tab.id);
  console.log("uploadResult:", uploadResult);

  let userPrefs = await browser.linshareExtAPI.getUserPrefs();
  console.log("userPrefs:", userPrefs);

  let composeDetails = await browser.compose.getComposeDetails(tab.id);
  console.log("composeDetails.body:", composeDetails.body);
  console.log("composeDetails.plainTextBody:", composeDetails.plainTextBody);
  console.log("composeDetails.isPlainText:", composeDetails.isPlainText);
  console.log("composeDetails.subject:", composeDetails.subject);

  if (composeDetails.subject.trim().length == 0) {
    console.log("Setting default subject");
    await browser.compose.setComposeDetails(tab.id, { subject: "Shared documents with Linshare" });
  }

  // Determine which body field to use
  const isPlainText = composeDetails.isPlainText;
  const currentBody = isPlainText ? composeDetails.plainTextBody : composeDetails.body;

  // Check if message already has LinShare content
  let hasMessage = currentBody.includes("linshare-default-message") || currentBody.includes("Votre document a été partagé via LinShare");
  console.log("hasMessage:", hasMessage);

  if (!hasMessage) {
    let linshareMessage;
    let newBody;

    // Generate file list with links (placeholder for now)
    const fileList = uploadResult.files.map(fileName => {
      return isPlainText
        ? `- ${fileName}`
        : `<li>${fileName}</li>`;
    }).join(isPlainText ? '\n' : '');

    if (isPlainText) {
      // Plain text version
      linshareMessage = `\n- - - - -\n${userPrefs.message}\n\nFichiers partagés:\n${fileList}\n`;
      newBody = (currentBody || '') + linshareMessage;
      console.log("Plain text mode - newBody length:", newBody.length);
      await browser.compose.setComposeDetails(tab.id, { plainTextBody: newBody });
    } else {
      // HTML version
      linshareMessage = `<div class="linshare-default-message">
      <p>- - - - -</p>
      <p>${userPrefs.message}</p>
      <p><strong>Fichiers partagés:</strong></p>
      <ul>${fileList}</ul>
    </div>`;

      console.log("linshareMessage:", linshareMessage);
      newBody = (currentBody || '') + linshareMessage;
      console.log("HTML mode - newBody length:", newBody.length);
      await browser.compose.setComposeDetails(tab.id, { body: newBody });
    }

    console.log("Body updated successfully");
  }

  browser.linshareExtAPI.sendMail();
}

console.log("LinShare Extension initialized");
