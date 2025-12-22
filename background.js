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

const configureComposeAction = async () => {
  console.log("Configuring compose action...");
  try {
    if (browser.composeAction) {
      await browser.composeAction.setTitle({
        title: browser.i18n.getMessage("shareButton")
      });
      console.log("Compose action title set");
    }
  } catch (error) {
    console.warn("Could not set compose action title:", error);
  }
};

configureComposeAction();
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



function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function extractEmail(recipient) {
  if (!recipient) return "";
  // Handle "Name <email@domain.com>" format
  const match = recipient.match(/<([^>]+)>/);
  return match ? match[1] : recipient.trim();
}

async function sendToLinshare(tab) {
  let attachments = await browser.compose.listAttachments(tab.id);
  let composeDetails = await browser.compose.getComposeDetails(tab.id);

  // Robustly gather all recipients
  let rawRecipients = [
    ...(composeDetails.to || []),
    ...(composeDetails.cc || []),
    ...(composeDetails.bcc || [])
  ];

  // Clean and deduplicate recipients
  let recipients = [...new Set(rawRecipients.map(extractEmail))].filter(email => email.length > 0);

  console.log("Processed recipients:", recipients);

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
      const data = await browser.storage.local.get(["linshareUserInfos", "linshareUserPrefs"]);
      if (data && data.linshareUserInfos) {
        settings = data.linshareUserInfos;
        // Merge preferences into settings if available, otherwise use defaults
        if (data.linshareUserPrefs) {
          settings.userPrefs = data.linshareUserPrefs;
        } else {
          settings.userPrefs = {
            message: "Votre document a été partagé via LinShare",
            accusedOfSharing: false,
            noDownload: false,
            secureShare: false
          };
        }
        console.log("Settings and preferences retrieved from storage for upload");
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

      // Return file info for link generation
      return {
        success: true,
        files: files.map(f => ({ name: f.name, size: f.size }))
      };
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
    await browser.compose.setComposeDetails(tab.id, { subject: browser.i18n.getMessage("shareNotificationSubject") });
  }

  // Determine which body field to use
  const isPlainText = composeDetails.isPlainText;
  const currentBody = isPlainText ? composeDetails.plainTextBody : composeDetails.body;

  // Check if message already has LinShare content
  let hasMessage = currentBody.includes("linshare-default-message") ||
    currentBody.includes("Votre document a été partagé via LinShare") ||
    currentBody.includes(browser.i18n.getMessage("defaultShareMessage"));
  console.log("hasMessage:", hasMessage);

  if (!hasMessage) {
    let linshareMessage;
    let newBody;

    // Generate file list with links
    let fileListHtml = "";
    uploadResult.files.forEach((file) => {
      fileListHtml += `
            <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="font-size: 20px; margin-right: 10px;">📄</span>
                <div style="flex-grow: 1;">
                    <div style="font-size: 14px; color: #333; font-weight: 500;">${file.name}</div>
                    <div style="font-size: 12px; color: #888;">${formatSize(file.size)}</div>
                </div>
            </div>
        `;
    });

    if (isPlainText) {
      // Plain text version
      const fileListText = uploadResult.files.map(f => `- ${f.name} (${formatSize(f.size)})`).join('\n');
      linshareMessage = `\n- - - - -\n${userPrefs.message}\n\n${browser.i18n.getMessage("shareNotificationFiles")}\n${fileListText}\n`;
      newBody = (currentBody || '') + linshareMessage;
      console.log("Plain text mode - newBody length:", newBody.length);
      await browser.compose.setComposeDetails(tab.id, { plainTextBody: newBody });
    } else {
      // HTML version with Card Design
      linshareMessage = `
        <br>
        <div class="linshare-default-message" style="font-family: 'Segoe UI', sans-serif; width: 90%; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background-color: #0078d4; padding: 15px; color: white; display: flex; align-items: center;">
                <strong style="font-size: 16px;">${browser.i18n.getMessage("shareNotificationHeader")}</strong>
            </div>
            
            <!-- Body -->
            <div style="padding: 15px; background-color: #ffffff; text-align: left;">
                <p style="margin-top: 0; margin-bottom: 15px; color: #555; font-size: 14px;">
                    ${userPrefs.message}
                </p>
                
                <div style="margin-bottom: 15px;">
                    ${fileListHtml}
                </div>
                
                <div style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 4px solid #0078d4;">
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        <strong>${browser.i18n.getMessage("shareNotificationNoteHeader")}</strong> ${browser.i18n.getMessage("shareNotificationNoteBody")}
                    </p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f5f5f5; padding: 10px; text-align: center; border-top: 1px solid #e0e0e0;">
                <a href="https://linshare.app" style="color: #0078d4; text-decoration: none; font-size: 12px;">${browser.i18n.getMessage("shareNotificationFooter")}</a>
            </div>
        </div>
        <br>
      `;

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
