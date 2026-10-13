# Raven Application Assistant

Chrome extension for saving jobs to Raven and assisting with applications.

## Safety model
- Raven requires explicit approval of the exact resume and cover letter before Apply unlocks.
- The extension fills only known profile fields.
- It never clicks Submit and never fills legal attestations, demographic questions, assessments, CAPTCHAs, salary, sponsorship, or unknown questions automatically.
- The user reviews the employer form before submission.

## Install
1. Download the Raven extension package.
2. Extract it.
3. Open chrome://extensions.
4. Enable Developer mode.
5. Choose Load unpacked and select the extracted extension folder.

Use Save to Raven from Chrome's context menu to capture a posting. Start applications from Raven after approving both documents.

## ChatGPT JSON handoff (2.2.0)
Update/reload the unpacked extension, accept the Downloads permission, and reload Raven and ChatGPT after installing. Use Raven's ChatGPT button to create a job-bound request. Send the prompt in ChatGPT with file creation available. The extension clicks the matching JSON attachment, reads the completed download from its ChatGPT URL, and queues its contents for Raven. Keep Raven open; it validates, saves, and opens review. Results remain queued until Raven acknowledges saving, including across reloads.

Only attachments named `raven-<request UUID>.json` for requests from the last 24 hours are transferred. Newer document changes prevent automatic replacement. Imports never approve or submit applications. If transfer fails, select the downloaded JSON file in Raven Import. Browsers without this extension require file import. Signed-in ChatGPT attachment delivery still needs live verification.
