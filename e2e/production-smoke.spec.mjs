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
    if (action === "transitionJob") {
      const previous = job.status || "Saved";
      job = { ...job, status: body.status, viewed: true };
      if (body.status === "Applied") {
        job.applied_date = job.applied_date || body.occurredAt || new Date().toISOString();
        job.follow_up = body.followUp || job.follow_up || new Date(Date.parse(job.applied_date) + 7 * 86400000).toISOString().slice(0, 10);
      } else if (["Interview", "Offer", "Rejected", "Ignored"].includes(body.status)) {
        job.follow_up = null;
      } else if (["Saved", "Interested", "Ready"].includes(body.status) && previous === "Applied") {
        job.applied_date = null;
        job.follow_up = null;
      }
      return route.fulfill({ json: { ok: true, job: { ...job }, event: { event_type: body.status.toLowerCase() } } });
    }
    if (action === "jobEvents") {
      return route.fulfill({ json: { ok: true, events: [] } });
    }
    if (action === "jobSnapshots") {
      return route.fulfill({ json: { ok: true, snapshots: [] } });
    }
    if (action === "analytics") {
      return route.fulfill({ json: { ok: true, analytics: { applications: 0, interviews: 0, offers: 0, rejections: 0, by_source: {}, by_track: {} } } });
    }
    if (action === "addJobEvent") {
      return route.fulfill({ json: { ok: true, event: { event_type: body.eventType || "note" } } });
    }
    if (action === "receiveApplicationSignal") {
      return route.fulfill({ json: { ok: true, matched: true, auto_applied: false, job } });
    }
    if (action === "addJob") {
      job = { ...job, ...body, id: job.id || "job-added" };
      delete job.action;
      return route.fulfill({ json: { ...job, ok: true } });
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

  test("manual ChatGPT prompt endpoint returns the grounded Raven contract", async ({ request }) => {
    const response=await request.post("https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/raven-generate-v1",{
      headers:{
        "Origin":"https://shipitmyguy-ux.github.io",
        "X-Raven-Client":"raven-web-v1",
        "Content-Type":"application/json"
      },
      data:{
        documentType:"resume",
        promptOnly:true,
        promptDocumentType:"both",
        track:"Games / 3D",
        jobTitle:"Synthetic Senior Environment Artist",
        company:"Raven Smoke Studio",
        jobDescription:"Create game environments, collaborate across disciplines, mentor artists, and work with Unreal Engine."
      }
    });
    expect(response.ok()).toBeTruthy();
    const payload=await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.format).toBe("raven-chatgpt-v1");
    expect(payload.prompt).toContain("raven-chatgpt-v1");
    expect(payload.prompt).toContain("ARK: Survival Evolved + DLCs");
    expect(payload.prompt).toContain("fact_ids");
    expect(payload.prompt).not.toContain("candidate@example.com");
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
    // Jobs and runtime settings load independently; bookmark transitions require configured statuses.
    await expect(page.locator('#statusFilter option[value="Interested"]')).toHaveCount(1);

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

    // Approved-document navigation now lives in the drawer's Job details disclosure.
    await page.locator('.job-detail-disclosure > summary').filter({ hasText: /^Job details$/ }).click();
    // Verify approved docs state enables Apply button
    const applyGate = page.locator("[data-approved-apply]");
    await expect(applyGate).toBeVisible();
    await expect(applyGate).toContainText("Continue with documents");
    await expect(applyGate).toBeEnabled();

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
    await page.locator('.job-detail-disclosure > summary').filter({ hasText: /^Job details$/ }).click();
    await expect(page.locator("[data-approved-apply]")).toBeVisible();
    await expect(page.locator("[data-approved-apply]")).toContainText("Continue with documents");
    await expect(page.locator("[data-approved-apply]")).toBeEnabled();
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
        <input id="first_name" name="job_application[first_name]" type="text" aria-label="First name" />
        <input id="last_name" name="job_application[last_name]" type="text" aria-label="Last name" />
        <input id="email" name="job_application[email]" type="text" aria-label="Email" />
        <input id="phone" name="job_application[phone]" type="text" aria-label="Phone" />
        <label>Are you willing to travel for business?<input type="text" /></label>
        <label>What is your expected annual salary?<input type="text" /></label>
        <label>Existing prefilled answer<input id="existing_field" type="text" value="Keep existing value" /></label>
        <input id="resume" type="file" accept=".pdf" aria-label="Resume" />
        <input id="cover_letter" type="file" accept=".pdf" aria-label="Cover letter" />
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
        <input name="name" data-qa="name-input" type="text" aria-label="Full name" />
        <input name="email" data-qa="email-input" type="text" aria-label="Email" />
        <input name="phone" data-qa="phone-input" type="text" aria-label="Phone" />
        <label>Willing to relocate?<input type="text" /></label>
        <label>Will you now or in the future require visa sponsorship?<input type="text" /></label>
        <input name="resume" type="file" accept=".pdf" aria-label="Resume" />
        <input name="cover_letter" type="file" accept=".pdf" aria-label="Cover letter" />
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
        <input name="full_name" type="text" aria-label="Full name" />
        <input name="email" type="email" aria-label="Email" />
        <input name="phone" type="tel" aria-label="Phone" />
        <label>Are you willing to travel?<input type="text" /></label>
        <label>What is your veteran status?<input type="text" /></label>
        <input name="resume" type="file" accept=".pdf" aria-label="Resume" />
        <input name="cover_letter" type="file" accept=".pdf" aria-label="Cover letter" />
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
        <input id="first_name" name="first_name" type="text" aria-label="First name" />
        <input id="last_name" name="last_name" type="text" aria-label="Last name" />
        <input id="email" name="email" type="email" aria-label="Email" />
        <label>Willing to travel for work?<input type="text" /></label>
        <label>Disability status disclosure<input type="text" /></label>
        <input type="file" data-automation-id="resume-upload" accept=".pdf" aria-label="Resume" />
        <input type="file" data-automation-id="cover-upload" accept=".pdf" aria-label="Cover letter" />
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
        <input id="first_name" name="first_name" type="text" aria-label="First name" />
        <input id="last_name" name="last_name" type="text" aria-label="Last name" />
        <input id="email" name="email" type="email" aria-label="Email" />
        <label>Willing to travel occasionally?<input type="text" /></label>
        <label>U.S. Citizenship or Work Authorization<input type="text" /></label>
        <input id="resume" name="resume" type="file" accept=".pdf" aria-label="Resume" />
        <input id="cover_letter" name="cover_letter" type="file" accept=".pdf" aria-label="Cover letter" />
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
        <input id="first_name" name="first_name" type="text" aria-label="First name" />
        <input id="last_name" name="last_name" type="text" aria-label="Last name" />
        <input id="email" name="email" type="email" aria-label="Email" />
        <label>Willingness to travel<input type="text" /></label>
        <label>Have you ever been convicted of a criminal offense?<input type="text" /></label>
        <input id="resume_file" name="resume_file" type="file" accept=".pdf" aria-label="Resume" />
        <input id="cover_file" name="cover_file" type="file" accept=".pdf" aria-label="Cover letter" />
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
        <input name="first_name" type="text" aria-label="First name" />
        <input name="last_name" type="text" aria-label="Last name" />
        <input name="email" type="email" aria-label="Email" />
        <input name="phone" type="tel" aria-label="Phone" />
        <label>Willing to travel for role?<input type="text" /></label>
        <label>Target desired compensation<input type="text" /></label>
        <input name="resume" type="file" accept=".pdf" aria-label="Resume" />
        <input name="cover_letter" type="file" accept=".pdf" aria-label="Cover letter" />
        <button type="submit">Submit Application</button>
      </form>
    `
  }
];

test.describe("Synthetic protocol 3 Application Assistant adapter smoke tests", () => {
  for (const fixture of ADAPTER_FIXTURES) {
    test(`${fixture.name} fills known fields, selects PDFs, preserves unrelated values, and never submits`, async ({ page }) => {
      await page.route(fixture.url, route => route.fulfill({
        status: 200, contentType: "text/html",
        body: `<!doctype html><html><body>${fixture.formHtml}</body></html>`
      }));
      const submissionRequests = [];
      page.on("request", request => {
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
          submissionRequests.push({ method: request.method(), url: request.url() });
      });
      await page.goto(fixture.url);
      await page.evaluate(() => {
        const form = document.querySelector("form");
        const existing = document.createElement("input");
        existing.type = "file"; existing.id = "existing_attachment";
        existing.name = "portfolio_attachment"; existing.accept = ".txt";
        form.appendChild(existing);
        const incompatible = document.createElement("input");
        incompatible.type = "file"; incompatible.id = "incompatible_attachment";
        incompatible.name = "resume_pdf_only"; incompatible.accept = ".docx";
        form.appendChild(incompatible);
        form.addEventListener("submit", event => {
          event.preventDefault();
          window.__formSubmitted = true;
        });
        form.addEventListener("change", event => {
          if (event.target?.type !== "file" || !event.target.files?.[0]) return;
          const confirmation = document.createElement("span");
          confirmation.textContent = event.target.files[0].name + " attached";
          event.target.parentElement.appendChild(confirmation);
        });
        window.chrome = { runtime: {
          lastError: null,
          onMessage: { addListener() {} },
          sendMessage(message, callback) { callback?.(null); }
        } };
      });
      await page.locator("#existing_attachment").setInputFiles({
        name: "existing-portfolio.txt", mimeType: "text/plain",
        buffer: Buffer.from("KEEP EXISTING FILE")
      });
      await page.addScriptTag({ path: "extension/src/assistant-core.js" });
      await page.addScriptTag({ path: "extension/src/prepare-content.js" });

      const pdf = "data:application/pdf;base64,JVBERi0xLjQK";
      const results = await page.evaluate(async pdfData => {
        const dom = window.RavenPrepareDom;
        const profile = await dom.applyOperation("profile", { profile: {
          firstName: "Raven", lastName: "Tester", fullName: "Raven Tester",
          email: "raven.tester@example.test", phone: "555-0199"
        }, answers: {} });
        const resume = await dom.applyOperation("resume", {
          document: { kind: "resume", dataUrl: pdfData }, company: "Smoke Test Inc"
        });
        const cover = await dom.applyOperation("coverLetter", {
          document: { kind: "coverLetter", dataUrl: pdfData }, company: "Smoke Test Inc"
        });
        return { adapter: window.RavenAssistantCore.detectAdapter(location.hostname).id,
          profile, resume, cover };
      }, pdf);
      expect(results.adapter).toBe(fixture.adapterId);
      expect(results.profile.state).toBe("filled");
      expect(results.resume.state).toBe("page_confirmed");
      expect(results.cover.state).toBe("page_confirmed");

      const emailInput = page.locator('input[type="email"], input[name*="email" i], #email').first();
      await expect(emailInput).toHaveValue("raven.tester@example.test");
      const prefilledInput = page.locator("#existing_field");
      if (await prefilledInput.count()) await expect(prefilledInput).toHaveValue("Keep existing value");
      const sensitive = page.locator('input[id*="salary" i], input[name*="salary" i], input[id*="visa" i], input[id*="sponsorship" i], input[id*="veteran" i], input[id*="disability" i], input[id*="citizenship" i], input[id*="criminal" i]').first();
      if (await sensitive.count()) await expect(sensitive).toHaveValue("");

      const files = await page.evaluate(async () => Promise.all(
        [...document.querySelectorAll('input[type="file"]')].map(async input => ({
          id: input.id, name: input.name, accept: input.accept,
          fileName: input.files?.[0]?.name || "",
          text: input.files?.[0] ? await input.files[0].text() : ""
        }))
      ));
      expect(files.filter(file => /resume/i.test(file.fileName) && file.text === "%PDF-1.4\n")).toHaveLength(1);
      expect(files.filter(file => /cover-letter/i.test(file.fileName) && file.text === "%PDF-1.4\n")).toHaveLength(1);
      expect(files.find(file => file.id === "existing_attachment")?.text).toBe("KEEP EXISTING FILE");
      expect(files.find(file => file.id === "incompatible_attachment")?.fileName).toBe("");
      expect(await page.evaluate(() => window.__formSubmitted === true)).toBe(false);
      expect(submissionRequests).toEqual([]);
    });
  }
});
