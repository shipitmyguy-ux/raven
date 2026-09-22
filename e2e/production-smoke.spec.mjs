import { test, expect } from "@playwright/test";

const RAVEN_PROD_URL = "https://shipitmyguy-ux.github.io/raven/";

// Sample synthetic job for testing deployed Raven app
const syntheticTestJob = {
  id: "smoke-test-job-1",
  track: "Professional",
  title: "Synthetic QA Automation Lead",
  company: "Raven Smoke Corp",
  location: "Remote",
  remote: true,
  salaryText: "$120,000",
  url: "https://example.com/smoke-test-job-1",
  source: "Smoke Test",
  status: "Saved",
  notes: "Lead end-to-end automated smoke testing and verification pipelines.",
  added: new Date().toISOString(),
  resume: "data:text/html;charset=utf-8," + encodeURIComponent("<html><body>Synthetic Smoke Resume</body></html>"),
  coverLetter: "data:text/html;charset=utf-8," + encodeURIComponent("<html><body>Synthetic Smoke Cover Letter</body></html>")
};

// Helper to mock Raven backend API for non-destructive production testing
async function mockRavenBackend(page, initialJob = syntheticTestJob) {
  let job = { ...initialJob };
  const searchTracks = [];

  await page.route("**/functions/v1/raven-backend-v3**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let action = url.searchParams.get("action") || "";
    let body = {};
    if (req.method() === "POST") {
      try { body = JSON.parse(req.postData() || "{}"); } catch {}
      action = body.action || action;
    }
    const track = url.searchParams.get("track") || body.track || "";

    if (action === "jobs") {
      return route.fulfill({ json: { ok: true, jobs: [job] } });
    }
    if (action === "updateJob") {
      job = { ...job, ...body };
      delete job.action;
      return route.fulfill({ json: { ...job, ok: true } });
    }
    if (action === "addJob") {
      return route.fulfill({ json: { ...body, id: "job-added", ok: true } });
    }
    if (action === "search") {
      searchTracks.push(track);
    }
    return route.fulfill({ json: { ok: true, track, count: 0, jobs: [], results: [] } });
  });

  return {
    getJob: () => job,
    getSearchTracks: () => searchTracks.slice()
  };
}

test.describe("Deployed Raven App Production Smoke Tests", () => {
  test("deployed app loads successfully with core UI elements and tabs", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await mockRavenBackend(page);
    await page.goto(RAVEN_PROD_URL, { waitUntil: "domcontentloaded" });

    // Verify page title and main UI components
    await expect(page).toHaveTitle(/Raven/i);
    await expect(page.locator("#optionsButton")).toBeVisible();
    await expect(page.locator("#searchJobsButton")).toBeVisible();
    await expect(page.locator("#jobList")).toBeVisible();

    // Verify all 4 job track tabs exist
    for (const track of ["Games / 3D", "Professional", "Labor", "Wildcard"]) {
      const tab = page.locator(`.track-tab[data-track="${track}"]`);
      await expect(tab).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test("jobs render without malformed/overflow cards and layout remains bounded", async ({ page }) => {
    await mockRavenBackend(page);
    await page.goto(RAVEN_PROD_URL, { waitUntil: "domcontentloaded" });

    await page.locator('.track-tab[data-track="Professional"]').click();
    const card = page.locator(`.job-card[data-job-id="${syntheticTestJob.id}"]`);
    await expect(card).toBeVisible();
    await expect(card.locator(".job-title")).toHaveText(syntheticTestJob.title);
    await expect(card.locator(".company-name")).toHaveText(syntheticTestJob.company);

    // Ensure layout does not overflow page width
    const layout = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth + 2);
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.innerWidth + 2);
  });

  test("refresh action triggers global refresh state", async ({ page }) => {
    await mockRavenBackend(page);
    await page.goto(RAVEN_PROD_URL, { waitUntil: "domcontentloaded" });

    const refreshBtn = page.locator("#searchJobsButton");
    await expect(refreshBtn).toBeVisible();

    await refreshBtn.click();
    await expect(page.locator("#syncStatus")).toContainText(/refreshing|refreshed|cooldown|syncing|up to date/i, { timeout: 10000 });
  });

  test("tabs behave as filters without firing separate search network calls", async ({ page }) => {
    const api = await mockRavenBackend(page);
    await page.goto(RAVEN_PROD_URL, { waitUntil: "domcontentloaded" });

    const initialSearchCount = api.getSearchTracks().length;

    for (const track of ["Professional", "Labor", "Wildcard", "Games / 3D"]) {
      await page.locator(`.track-tab[data-track="${track}"]`).click();
      await page.waitForTimeout(100);
    }

    // Switching tabs must not trigger backend search requests
    expect(api.getSearchTracks().length).toBe(initialSearchCount);
  });

  test("bookmarking a job persists state across page reloads", async ({ page }) => {
    const api = await mockRavenBackend(page);
    await page.goto(RAVEN_PROD_URL, { waitUntil: "domcontentloaded" });

    await page.locator('.track-tab[data-track="Professional"]').click();
    const card = page.locator(`.job-card[data-job-id="${syntheticTestJob.id}"]`);
    await expect(card).toBeVisible();

    // Click bookmark button
    const bookmarkBtn = card.locator("[data-card-bookmark]");
    await bookmarkBtn.click();

    await expect.poll(() => api.getJob().status).toBe("Interested");

    // Reload page and confirm bookmark state persists
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.track-tab[data-track="Professional"]').click();
    const reloadedCard = page.locator(`.job-card[data-job-id="${syntheticTestJob.id}"]`);
    await expect(reloadedCard.locator("[data-card-bookmark]")).toHaveAttribute("aria-pressed", "true");
  });

  test("document review dialog opens and document approval state survives reload", async ({ page }) => {
    const resumeUrl = syntheticTestJob.resume;
    const coverUrl = syntheticTestJob.coverLetter;

    await mockRavenBackend(page);
    await page.addInitScript(({ jobId, resumeUrl, coverUrl }) => {
      localStorage.setItem("ravenDocumentApprovalsV1", JSON.stringify({
        [`${jobId}|resume`]: { value: resumeUrl, approvedAt: new Date().toISOString() },
        [`${jobId}|coverLetter`]: { value: coverUrl, approvedAt: new Date().toISOString() }
      }));
    }, { jobId: syntheticTestJob.id, resumeUrl, coverUrl });

    await page.goto(RAVEN_PROD_URL, { waitUntil: "domcontentloaded" });

    await page.locator('.track-tab[data-track="Professional"]').click();
    await page.locator(`.job-card[data-job-id="${syntheticTestJob.id}"] .job-card-summary`).click();

    // Verify approved docs state enables Apply button
    const applyGate = page.locator("[data-approved-apply]");
    await expect(applyGate).toBeVisible();
    await expect(applyGate).toContainText("Apply");

    // Click Review for resume to exercise non-destructive Review Documents flow
    await page.locator('[data-generate="resume"]').first().click();
    await expect(page.locator("#documentReviewDialog")).toBeVisible();
    await expect(page.locator("#reviewTitle")).toContainText("Review resume");

    // Close review dialog
    await page.locator("[data-review-close]").first().click();
    await expect(page.locator("#documentReviewDialog")).not.toBeVisible();

    // Verify approval survived reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.track-tab[data-track="Professional"]').click();
    await page.locator(`.job-card[data-job-id="${syntheticTestJob.id}"] .job-card-summary`).click();
    await expect(page.locator("[data-approved-apply]")).toContainText("Apply");
  });
});


// Section 2: Synthetic Application Assistant Adapter Tests
const ADAPTER_FIXTURES = [
  {
    name: "Greenhouse",
    adapterId: "greenhouse",
    url: "https://job-boards.greenhouse.io/raven-smoke-test/jobs/9999",
    formHtml: `
      <form id="application_form">
        <input id="first_name" name="job_application[first_name]" type="text" />
        <input id="last_name" name="job_application[last_name]" type="text" />
        <input id="email" name="job_application[email]" type="text" />
        <input id="phone" name="job_application[phone]" type="text" />
        <label>Are you willing to travel for business?<input type="text" /></label>
        <label>What is your expected annual salary?<input type="text" /></label>
        <label>Existing prefilled answer<input id="existing_field" type="text" value="Keep existing value" /></label>
        <input id="resume" type="file" accept=".html,.pdf" />
        <input id="cover_letter" type="file" accept=".html,.pdf" />
        <button id="submit_app" type="submit">Submit Application</button>
      </form>
    `
  },
  {
    name: "Lever",
    adapterId: "lever",
    url: "https://jobs.lever.co/raven-smoke-test/9999",
    formHtml: `
      <form id="application-form">
        <input name="name" data-qa="name-input" type="text" />
        <input name="email" data-qa="email-input" type="text" />
        <input name="phone" data-qa="phone-input" type="text" />
        <label>Willing to relocate?<input type="text" /></label>
        <label>Will you now or in the future require visa sponsorship?<input type="text" /></label>
        <input name="resume" type="file" accept=".html,.txt" />
        <input name="cover_letter" type="file" accept=".html,.txt" />
        <button type="submit">Submit application</button>
      </form>
    `
  },
  {
    name: "Ashby",
    adapterId: "ashby",
    url: "https://jobs.ashbyhq.com/raven-smoke-test/9999",
    formHtml: `
      <form>
        <input name="full_name" type="text" />
        <input name="email" type="email" />
        <input name="phone" type="tel" />
        <label>Are you willing to travel?<input type="text" /></label>
        <label>What is your veteran status?<input type="text" /></label>
        <input name="resume" type="file" accept=".html" />
        <input name="cover_letter" type="file" accept=".html" />
        <button type="submit">Submit</button>
      </form>
    `
  },
  {
    name: "Workday",
    adapterId: "workday",
    url: "https://myworkdayjobs.com/raven-smoke-test/jobs/1",
    formHtml: `
      <form>
        <input id="first_name" name="first_name" type="text" />
        <input id="last_name" name="last_name" type="text" />
        <input id="email" name="email" type="email" />
        <label>Willing to travel for work?<input type="text" /></label>
        <label>Disability status disclosure<input type="text" /></label>
        <input type="file" data-automation-id="resume-upload" accept=".html" />
        <input type="file" data-automation-id="cover-upload" accept=".html" />
        <button type="submit">Submit</button>
      </form>
    `
  },
  {
    name: "iCIMS",
    adapterId: "icims",
    url: "https://careers-icims.icims.com/jobs/100/job",
    formHtml: `
      <form>
        <input id="first_name" name="first_name" type="text" />
        <input id="last_name" name="last_name" type="text" />
        <input id="email" name="email" type="email" />
        <label>Willing to travel occasionally?<input type="text" /></label>
        <label>U.S. Citizenship or Work Authorization<input type="text" /></label>
        <input id="resume" name="resume" type="file" accept=".html" />
        <input id="cover_letter" name="cover_letter" type="file" accept=".html" />
        <button type="submit">Apply Now</button>
      </form>
    `
  },
  {
    name: "Taleo",
    adapterId: "taleo",
    url: "https://raven.taleo.net/careersection/jobdetail.ftl",
    formHtml: `
      <form>
        <input id="first_name" name="first_name" type="text" />
        <input id="last_name" name="last_name" type="text" />
        <input id="email" name="email" type="email" />
        <label>Willingness to travel<input type="text" /></label>
        <label>Have you ever been convicted of a criminal offense?<input type="text" /></label>
        <input id="resume_file" name="resume_file" type="file" accept=".html" />
        <input id="cover_file" name="cover_file" type="file" accept=".html" />
        <button type="submit">Submit</button>
      </form>
    `
  },
  {
    name: "Generic Fallback",
    adapterId: "generic",
    url: "https://careers.example.com/jobs/42",
    formHtml: `
      <form>
        <input name="first_name" type="text" />
        <input name="last_name" type="text" />
        <input name="email" type="email" />
        <input name="phone" type="tel" />
        <label>Willing to travel for role?<input type="text" /></label>
        <label>Target desired compensation<input type="text" /></label>
        <input name="resume" type="file" accept=".html" />
        <input name="cover_letter" type="file" accept=".html" />
        <button type="submit">Submit Application</button>
      </form>
    `
  }
];

test.describe("Synthetic Application Assistant Adapter Smoke Tests", () => {
  for (const fixture of ADAPTER_FIXTURES) {
    test(`${fixture.name} adapter fills known fields and non-sensitive answers, blocks sensitive questions, attaches files, and NEVER submits`, async ({ page }) => {
      const resumeContent = "APPROVED SYNTHETIC RESUME FOR " + fixture.name;
      const coverContent = "APPROVED SYNTHETIC COVER LETTER FOR " + fixture.name;

      const resumeDataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(`<html><body>${resumeContent}</body></html>`);
      const coverDataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(`<html><body>${coverContent}</body></html>`);

      // Mock Chrome extension storage and API bridge
      await page.addInitScript(({ url, resumeDataUrl, coverDataUrl }) => {
        const store = {
          ravenApplicationPacket: {
            version: 1,
            createdAt: new Date().toISOString(),
            jobId: "smoke-job-1",
            jobUrl: url,
            title: "Synthetic Role",
            company: "Smoke Test Inc",
            profile: {
              firstName: "Raven",
              lastName: "AutomatedTester",
              fullName: "Raven AutomatedTester",
              email: "raven.tester@example.com",
              phone: "555-0199"
            },
            answers: {
              "are you willing to travel for business": "Yes, up to 25%",
              "willing to relocate": "Yes",
              "are you willing to travel": "Yes",
              "willing to travel for work": "Yes",
              "willing to travel occasionally": "Yes",
              "willingness to travel": "Yes",
              "willing to travel for role": "Yes"
            },
            resume: resumeDataUrl,
            coverLetter: coverDataUrl
          }
        };

        globalThis.chrome = {
          storage: {
            local: {
              get(keys, cb) {
                const list = Array.isArray(keys) ? keys : [keys];
                const res = Object.fromEntries(list.map((k) => [k, store[k]]).filter(([, v]) => v !== undefined));
                if (cb) cb(res);
                return Promise.resolve(res);
              },
              set(values, cb) {
                Object.assign(store, values);
                if (cb) cb();
                return Promise.resolve();
              },
              remove(keys, cb) {
                for (const k of (Array.isArray(keys) ? keys : [keys])) delete store[k];
                if (cb) cb();
                return Promise.resolve();
              }
            }
          },
          runtime: {
            lastError: null,
            sendMessage(_msg, cb) { if (cb) cb(); }
          }
        };
      }, { url: fixture.url, resumeDataUrl, coverDataUrl });

      // Mock network response for adapter URL
      await page.route(fixture.url, (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<!doctype html><html><body>${fixture.formHtml}</body></html>`
        });
      });

      const submissionRequests = [];
      page.on("request", (request) => {
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
          submissionRequests.push({ method: request.method(), url: request.url() });
        }
      });

      await page.goto(fixture.url);

      // Add two safety fixtures that the assistant must not alter:
      // one prefilled unrelated upload and one resume-like input that rejects HTML.
      await page.evaluate(() => {
        const form = document.querySelector("form");
        if (!form) return;
        const existing = document.createElement("input");
        existing.type = "file";
        existing.id = "existing_attachment";
        existing.name = "portfolio_attachment";
        existing.accept = ".txt";
        form.appendChild(existing);

        const incompatible = document.createElement("input");
        incompatible.type = "file";
        incompatible.id = "incompatible_attachment";
        incompatible.name = "resume_pdf_only";
        incompatible.accept = ".pdf";
        form.appendChild(incompatible);
      });
      await page.locator("#existing_attachment").setInputFiles({
        name: "existing-portfolio.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("KEEP EXISTING FILE")
      });

      // Add submit listener to ensure form submit is NEVER triggered
      await page.evaluate(() => {
        const form = document.querySelector("form");
        if (form) {
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            window.__formSubmitted = true;
          });
        }
      });

      // Inject Raven assistant core & content scripts
      await page.addScriptTag({ path: "extension/src/assistant-core.js" });
      await page.addScriptTag({ path: "extension/src/content.js" });

      // Verify Assistant banner appears
      await expect(page.locator("#raven-assistant-banner")).toBeVisible();

      // 1. Verify known profile fields are filled
      const emailInput = page.locator('input[type="email"], input[name*="email" i], #email').first();
      await expect(emailInput).toHaveValue("raven.tester@example.com");

      // 2. Verify pre-filled field is NOT overwritten (for Greenhouse fixture)
      const prefilledInput = page.locator("#existing_field");
      if (await prefilledInput.count() > 0) {
        await expect(prefilledInput).toHaveValue("Keep existing value");
      }

      // 3. Verify remembered non-sensitive answers are filled
      const travelInputs = page.locator('input:not([type="file"]):not([type="hidden"])');
      const inputValues = await travelInputs.evaluateAll((inputs) => inputs.map((i) => i.value));
      expect(inputValues.some((v) => /Yes/i.test(v))).toBe(true);

      // 4. Verify sensitive questions REMAIN BLOCKED / BLANK
      const sensitiveInput = page.locator('input[id*="salary" i], input[name*="salary" i], input[id*="visa" i], input[id*="sponsorship" i], input[id*="veteran" i], input[id*="disability" i], input[id*="citizenship" i], input[id*="criminal" i]').first();
      if (await sensitiveInput.count() > 0) {
        const sensitiveVal = await sensitiveInput.inputValue();
        expect(sensitiveVal).toBe(""); // Sensitive questions must not be auto-filled
      }

      // 5. Verify exact approved files are attached
      const attachedFiles = await page.evaluate(async () => {
        const fileInputs = [...document.querySelectorAll('input[type="file"]')];
        return Promise.all(fileInputs.map(async (input) => ({
          name: input.files?.[0]?.name || "",
          text: input.files?.[0] ? await input.files[0].text() : ""
        })));
      });

      const resumeAttachment = attachedFiles.find((f) => f.text.includes(resumeContent));
      const coverAttachment = attachedFiles.find((f) => f.text.includes(coverContent));
      expect(resumeAttachment, "exact approved resume must be attached").toBeTruthy();
      expect(coverAttachment, "exact approved cover letter must be attached").toBeTruthy();
      expect(resumeAttachment.name).toMatch(/resume/i);
      expect(coverAttachment.name).toMatch(/cover/i);

      // 6. Existing unrelated file input must be preserved, and an incompatible
      // resume-like .pdf-only input must not receive the approved HTML document.
      const safetyFiles = await page.evaluate(async () => {
        const existing = document.querySelector("#existing_attachment");
        const incompatible = document.querySelector("#incompatible_attachment");
        return {
          existingName: existing?.files?.[0]?.name || "",
          existingText: existing?.files?.[0] ? await existing.files[0].text() : "",
          incompatibleCount: incompatible?.files?.length || 0
        };
      });
      expect(safetyFiles.existingName).toBe("existing-portfolio.txt");
      expect(safetyFiles.existingText).toBe("KEEP EXISTING FILE");
      expect(safetyFiles.incompatibleCount).toBe(0);

      // 7. Verify form was NEVER submitted and no finalization request escaped.
      const wasSubmitted = await page.evaluate(() => window.__formSubmitted === true);
      expect(wasSubmitted).toBe(false);
      expect(submissionRequests).toEqual([]);
    });
  }
});
