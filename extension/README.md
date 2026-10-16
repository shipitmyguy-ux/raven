# Raven Application Assistant

Chrome extension for saving jobs to Raven and assisting with applications.

## Safety model
- Apply is available even when no resume or cover letter has been generated. The extension uses any saved compatible documents.
- The extension fills only known profile fields.
- It never clicks Submit and never fills legal attestations, demographic questions, assessments, CAPTCHAs, salary, sponsorship, or unknown questions automatically.
- The user decides whether and when to submit the employer form.

## Install and update
GitHub Pages builds the installable ZIP from committed `extension/src/` files on each
eligible `main` deployment. Download
[the Raven extension ZIP](https://shipitmyguy-ux.github.io/raven/extension/raven-capture-extension.zip)
and extract it. The extracted folder must contain `manifest.json` at its top level.

For a new installation, open `chrome://extensions`, enable Developer mode, and
choose **Load unpacked** with that extracted folder. For an existing unpacked
installation, replace the files in the folder Chrome already loads or load the
new extracted folder, then click **Reload** for Raven Application Assistant and
refresh the Raven tab. A GitHub Pages deployment does not update an already
loaded unpacked extension automatically.

The protocol 3 Apply bridge and Mad Head placeholder/file-control recognition ship in manifest version 2.6.1. Verify the
installed extension shows that version before testing Apply. It opens and binds
the employer tab, inspects the current form, and handles each document
independently; the user remains responsible for final submission.

Use Save to Raven from Chrome's context menu to capture a posting. Start applications from Raven whenever you are ready; document generation runs separately.

## ChatGPT JSON handoff (2.2.0)
Update/reload the unpacked extension, accept the Downloads permission, and reload Raven and ChatGPT after installing. Use Raven's ChatGPT button to create a job-bound request. Send the prompt in ChatGPT with file creation available. The extension clicks the matching JSON attachment, reads the completed download from its ChatGPT URL, and queues its contents for Raven. Keep Raven open; it validates, saves, and opens review. Results remain queued until Raven acknowledges saving, including across reloads.

Only attachments named `raven-<request UUID>.json` for requests from the last 24 hours are transferred. Newer document changes prevent automatic replacement. Imports never approve or submit applications. If transfer fails, select the downloaded JSON file in Raven Import. Browsers without this extension require file import. Signed-in ChatGPT attachment delivery still needs live verification.
