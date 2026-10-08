# Document export inspection 2026-10-08

## Confirmed defect and fix
Word export dropped explicit HTML line breaks: the cover-letter closing and signature were rendered as one joined string. Reproduced using the actual `blocksFromHtml` and `docxFromBlocks` functions on a historical Raven QA cover letter, then rendered the produced DOCX with the packaged LibreOffice renderer. The broken closing was visually confirmed.

`blocksFromHtml` now replaces `<br>` elements with newline text in a clone before whitespace normalization. `docxFromBlocks` encodes those newlines as OOXML `w:br` elements. Resume paragraphs and metadata continue to use the existing path. No source prose, qualifications, saved records, approvals, generator safeguards or PDF layout were changed. The import/module and frontend cache versions are bumped for delivery.

## Verified scope
Base: GitHub main at 74e852c. PR #55 was already merged, so no frontend feature branch was needed. Work used the independent `raven-export` checkout; the active MCP checkout and files were untouched. Work usage information was not exposed.

Representative source documents were historical local Raven QA outputs: a full Games / 3D resume with eight roles, education and seven shipped credits, and a cover letter with three body paragraphs plus greeting/closing/signature. Existing content was used verbatim for layout QA, not certified anew as factual application material. Private sample files and images were not committed.

Actual Word conversion functions ran in the bundled Node runtime with a DOMParser implementation. The resulting real OOXML ZIPs were rendered through `render_docx.py` with LibreOffice. Current production HTML renderer functions ran against those source documents; WeasyPrint generated corresponding PDF files. All final page images were visually inspected. No clipping, overlap, missing glyphs or separated section heading was observed. The resume's second Word page is sparse but contains the complete shipped-credit section; content was not removed to force one page.

| Format and sample | Pages | Source blocks checked | Missing blocks | Characters outside page |
|---|---:|---:|---:|---:|
| Word resume via LibreOffice | 2 | 29 | 0 | 0 |
| HTML/PDF resume via WeasyPrint | 2 | 29 | 0 | 0 |
| Word cover via LibreOffice | 1 | 5 | 0 | 0 |
| HTML/PDF cover via WeasyPrint | 1 | 5 | 0 | 0 |

Text checks included every source block (role/company/date components checked separately because PDF column reading order differs), all bullets, education, complete credits, and the letter's greeting/body/closing/signature. Page character bounds were also checked. Visual QA, not extraction alone, established layout acceptance for these samples.

## Regression validation
- All existing commands in the repository core CI stage passed locally, including four resume-transfer tests with a new OOXML line-break regression.
- Actual HTML extraction preserved explicit closing/signature breaks and encoded ampersands.
- JavaScript syntax, repository secret scan and `git diff --check` passed.
- Added an isolated browser regression for HTML extraction -> DOCX text preservation and no duplicate resume blocks. It is not locally browser-verified: Chromium is unavailable and Playwright's browser download returned unusable archives. CI can run it with its installed browser.

## Acceptance limits and next step
LibreOffice rendering is not native Microsoft Word acceptance. WeasyPrint rendering is not a Chrome print dialog or an actual Save as PDF click. Neither the live app download click nor the user's native Word/print environment was verified here. The change is prepared for review; production publishing is not performed by this worker. After integration/deployment, verify the live Word download and browser Save as PDF once with the user's normal browser. Signed-in ChatGPT attachment transfer remains separate and unverified.
