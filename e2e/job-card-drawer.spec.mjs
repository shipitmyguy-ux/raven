import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const resumeHtml = `data:text/html;charset=utf-8,${encodeURIComponent(
  "<!doctype html><html><body><h1>Test Candidate</h1><p>Reviewable resume</p></body></html>"
)}`;

const savedJob = {
  id: "job-drawer-1",
  track: "Professional",
  title: "Implementation Project Manager",
  company: "Acme Health",
  location: "Remote",
  remote: true,
  salary_text: "$90,000",
  url: "https://example.com/job/1?utm_source=test",
  source: "Mock",
  status: "Saved",
  notes: "Lead implementation projects and coordinate stakeholders.",
  added: new Date("2026-10-14T12:00:00Z").toISOString(),
  resume: resumeHtml,
  cover_letter: "",
};

async function openFixture(page, { boardScreenshot } = {}) {
  let job = { ...savedJob };
  let generateCalls = 0;
  let helperCalls = 0;

  await page.route("**/runtime-config.json", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.settings["chatgpt-one-click"] = true;
    await route.fulfill({ json: config });
  });

  await page.route("**/functions/v1/raven-backend-v3**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === "POST" ? JSON.parse(request.postData() || "{}") : {};
    const action = body.action || url.searchParams.get("action") || "";
    if (action === "jobs") return route.fulfill({ json: { ok: true, jobs: [job] } });
    if (action === "updateJob") {
      const { action: _action, ...changes } = body;
      job = { ...job, ...changes };
      return route.fulfill({ json: { ...job, ok: true } });
    }
    if (action === "jobEvents") return route.fulfill({ json: { ok: true, events: [] } });
    if (action === "jobSnapshots") return route.fulfill({ json: { ok: true, snapshots: [] } });
    if (action === "coverage") {
      return route.fulfill({ json: { ok: true, coverage: { ready: 0, total: 0, missing: [] } } });
    }
    if (action === "listResults") return route.fulfill({ json: { ok: true, results: [] } });
    return route.fulfill({ json: { ok: true, jobs: [], results: [], count: 0, phase: "quick" } });
  });
  await page.route(/\/functions\/v1\/raven-(?:generate|cover)[^/?]*/, (route) => {
    generateCalls += 1;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("http://127.0.0.1:8766/**", (route) => {
    helperCalls += 1;
    return route.abort();
  });
  await page.route("**/functions/v1/raven-enrich-v1**", (route) =>
    route.fulfill({ json: { ok: true, description: savedJob.notes } })
  );
  await page.route("**/functions/v1/raven-commute-v1**", (route) =>
    route.fulfill({ json: { ok: true, minutes: 0 } })
  );
  await page.route("**/functions/v1/raven-data-v1**", (route) =>
    route.fulfill({ status: 410, json: { ok: false, error: "retired" } })
  );

  await page.goto("/");
  await page.locator('[data-track="Professional"]').click();
  const card = page.locator(".job-card-summary").first();
  await expect(card).toBeVisible();
  if (boardScreenshot) await saveScreenshot(page, boardScreenshot);
  await card.click();
  const panel = page.locator("#jobDetailPanel");
  await expect(panel).toBeVisible();
  return { card, panel, generateCalls: () => generateCalls, helperCalls: () => helperCalls };
}

async function saveScreenshot(page, name) {
  await mkdir("test-results", { recursive: true });
  const path = join("test-results", name);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

async function expectCompactCardLayout(card) {
  const geometry = await card.evaluate((element) => {
    const cardElement = element.closest(".job-card");
    const cardRect = cardElement.getBoundingClientRect();
    const summaryRect = element.getBoundingClientRect();
    const titleRect = element.querySelector(".job-title").getBoundingClientRect();
    const statusRect = element.querySelector(".job-status").getBoundingClientRect();
    const markerRect = cardElement.querySelector(".remote-watermark")?.getBoundingClientRect();
    return {
      leftPadding: titleRect.left - cardRect.left,
      rightPadding: cardRect.right - titleRect.right,
      statusBottom: statusRect.bottom,
      titleTop: titleRect.top,
      summaryLeft: summaryRect.left,
      markerWidth: markerRect?.width ?? 0,
    };
  });
  expect(geometry.leftPadding).toBeGreaterThanOrEqual(12);
  expect(geometry.rightPadding).toBeGreaterThanOrEqual(36);
  expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.statusBottom - 1);
  expect(geometry.markerWidth).toBeLessThanOrEqual(24);
  await expect(card.locator(".job-location")).toHaveText("Remote");
}

test("desktop drawer contains focus and restores the card after nested Review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { card, panel } = await openFixture(page);
  const close = panel.locator("[data-close-job-detail]");
  await expect(panel).toHaveAttribute("role", "dialog");
  await expect(panel).toHaveAttribute("aria-modal", "true");
  await expect(close).toBeFocused();
  await saveScreenshot(page, "job-card-drawer-desktop.png");

  await page.keyboard.press("Shift+Tab");
  await expect(panel.locator(".job-detail-disclosure").last().locator("summary")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  const review = panel.locator('[data-generate="resume"]');
  await expect(review).toHaveText(/Review/);
  await review.click();
  const reviewDialog = page.locator("#documentReviewDialog");
  await expect(reviewDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reviewDialog).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(review).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute("aria-expanded", "false");
  await saveScreenshot(page, "job-card-board-desktop.png");
  await expectCompactCardLayout(card);
});

test("mobile drawer stays within a 375px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { card, panel } = await openFixture(page, { boardScreenshot: "job-card-board-mobile-375.png" });
  await expectCompactCardLayout(card);
  await expect(panel.locator(".document-row")).toHaveCount(2);
  const bounds = await page.evaluate(() => {
    const rect = document.querySelector("#jobDetailPanel").getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.viewportWidth);
  await saveScreenshot(page, "job-card-drawer-mobile-375.png");
});

test("employer listing opens without generating documents", async ({ page, context }) => {
  await context.route("https://example.com/job/1**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Employer listing</h1>" })
  );
  const { panel, generateCalls, helperCalls } = await openFixture(page);
  const link = panel.locator("[data-employer-link]");
  await expect(link).toHaveAttribute("href", savedJob.url);
  await expect(link).toHaveAttribute("target", "_blank");
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: "Employer listing" })).toBeVisible();
  expect(generateCalls()).toBe(0);
  expect(helperCalls()).toBe(0);
  await popup.close();
});
