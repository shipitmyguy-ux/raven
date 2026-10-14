import { test, expect } from "@playwright/test";
import fs from "node:fs";

const pdf = "data:application/pdf;base64,JVBERi0xLjQK";
const packet = {
  version: 2, mode: "prepare", createdAt: new Date().toISOString(), jobId: "JT-179",
  jobUrl: "https://jobs.ashbyhq.com/believer/f031cf45-a4dd-40c5-8c00-b26c1c431dd8",
  title: "Senior Artist", company: "Believer", profile: {
    firstName: "Ari", lastName: "Lee", email: "ari@example.test", portfolio: "https://portfolio.example/ari"
  }, answers: { "will you need sponsorship": "No" }, resume: pdf, coverLetter: pdf
};

test("Ashby prepare fills known fields and reports delayed accepted or rejected PDF inputs without submitting", async ({ page }) => {
  await page.addInitScript(value => {
    const messages = [];
    Object.defineProperty(window, "__ravenMessages", { value: messages });
    Object.defineProperty(window, "chrome", { configurable: true, value: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          messages.push(message);
          if (message.type === "raven-prepare-ready") callback({ packet: value });
        }
      }
    } });
  }, packet);
  await page.route("https://jobs.ashbyhq.com/**", route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: `<!doctype html><html><body>
      <form id="application" onsubmit="window.__submitted=(window.__submitted||0)+1;event.preventDefault()">
        <label for="_systemfield_name">Name</label><input id="_systemfield_name" type="text">
        <label for="_systemfield_email">Email</label><input id="_systemfield_email" type="email">
        <label for="portfolio-field">Portfolio/website</label><input id="portfolio-field" type="text">
        <label for="sponsorship">Will you need sponsorship?</label><input id="sponsorship" type="radio" value="No">
        <div class="upload-field"><label for="autofill-resume">Autofill from resume</label><input id="autofill-resume" type="file" name="resume_import"></div>
        <div class="upload-field"><label for="_systemfield_resume">Resume</label><input id="_systemfield_resume" type="file" accept=".pdf"></div>
        <div class="upload-field"><label for="cover-uuid-17">Cover Letter</label><input id="cover-uuid-17" type="file" accept="application/pdf"></div>
        <button type="submit">Submit application</button>
      </form>
    </body></html>`
  }));
  await page.goto("https://jobs.ashbyhq.com/believer/f031cf45-a4dd-40c5-8c00-b26c1c431dd8/application");
  await page.evaluate(() => document.addEventListener("change", event => {
    if (event.target?.type !== "file" || !event.target.files?.[0]) return;
    const input = event.target;
    setTimeout(() => {
      const status = document.createElement("span");
      status.className = "upload-acceptance";
      status.textContent = input.id === "cover-uuid-17" ? "Upload failed: unsupported file" : input.files[0].name;
      input.closest(".upload-field").appendChild(status);
    }, 1200);
  }));
  await page.addScriptTag({ content: fs.readFileSync(new URL("../extension/src/assistant-core.js", import.meta.url), "utf8") });
  await page.addScriptTag({ content: fs.readFileSync(new URL("../extension/src/prepare-content.js", import.meta.url), "utf8") });

  await expect(page.locator("#raven-assistant-banner")).toContainText("Review every field and attachment, then submit manually", { timeout: 5000 });
  await expect(page.locator("#raven-assistant-banner")).toContainText("Selected, upload not confirmed: coverLetter");
  await expect(page.locator("#_systemfield_name")).toHaveValue("Ari Lee");
  await expect(page.locator("#_systemfield_email")).toHaveValue("ari@example.test");
  await expect(page.locator("#portfolio-field")).toHaveValue("https://portfolio.example/ari");
  await expect(page.locator("#sponsorship")).not.toBeChecked();
  await expect.poll(() => page.locator("#autofill-resume").evaluate(input => input.files.length)).toBe(0);
  await expect.poll(() => page.locator("#_systemfield_resume").evaluate(input => input.files.length)).toBe(1);
  await expect.poll(() => page.locator("#cover-uuid-17").evaluate(input => input.files.length)).toBe(1);
  await expect.poll(() => page.locator("#_systemfield_resume").evaluate(input => input.files[0]?.type)).toBe("application/pdf");
  await expect.poll(() => page.locator("#cover-uuid-17").evaluate(input => input.files[0]?.type)).toBe("application/pdf");
  expect(await page.evaluate(() => window.__submitted || 0)).toBe(0);
  const result = await page.evaluate(() => window.__ravenMessages.find(message => message.type === "raven-prepare-result"));
  expect(result.result.attached).toEqual(["resume"]);
  expect(result.result.selected).toEqual(["resume", "coverLetter"]);
  expect(result.result.filled).toContain("fullName");
});
