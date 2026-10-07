# Resume downloads and ChatGPT files

For an already-generated resume, the … menu next to Review includes **Download resume**, which downloads Word directly. The item is absent before generation. PDF saving remains available in review.

Review a saved resume or cover letter to access **Download Word** (real OOXML `.docx`, selectable Unicode text) or **Save as PDF** (browser print dialog; choose Save as PDF and disable headers/footers). Word uses a single-column document with headings and bullet text. PDF preserves Raven's styled document. Downloads do not approve documents or submit applications.

The frontend adds file-delivery instructions to the existing server-grounded prompt, asking ChatGPT to create a UTF-8 JSON attachment instead of printing the resume. Evidence IDs and `raven-chatgpt-v1` remain intact, plus a random `request_id`. File creation requires ChatGPT's file tool.

Extension 2.2.0 watches assistant attachment links for the exact requested filename, initiates download, reads the completed ChatGPT download URL, and queues results until Raven acknowledges saving. Raven binds requests to the saved job, validates every requested document through the existing manual-draft service, rejects stale requests or newer document changes, persists through the existing document path, and leaves approval required. No Supabase deployment or schema change is needed.

Without the updated extension, use Import and select the JSON file; selection immediately validates/imports for the selected job. Pasting remains available. Browser origin isolation requires a bridge for automatic transfer.

Verification: Eleven focused unit tests and two mocked Edge browser checks passed, including Word download, print invocation, automatic import, and saved-document reload. Current signed-in ChatGPT attachment selectors/URLs and final Word/PDF pagination remain live acceptance checks. Extension installation/reload is required on the user's device.
