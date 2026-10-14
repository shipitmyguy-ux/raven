import {readFile} from 'node:fs/promises';
import {test, expect} from '@playwright/test';

const source = await readFile(new URL('../extension/src/prepare-content.js', import.meta.url), 'utf8');
const applicationUrl = 'https://jobs.ashbyhq.com/hyperhug/bd5519f4-95f9-4c0b-90f2-b191e290b1af/application';
const form = `
  <h1>Environment &amp; Prop Artist</h1><p>HyperHug</p>
  <form><label>First name <input name="firstName"></label>
  <label>Email <input type="email" name="email"></label>
  <label>Resume <input type="file" name="resume"></label></form>`;

async function inspect(page, extra, {url = applicationUrl, formHtml = form, fastRetry = false} = {}) {
  await page.route('**/*', route => route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()
    ? route.fulfill({status: 200, contentType: 'text/html', body: `<html><body>${formHtml}${extra}</body></html>`})
    : route.abort());
  await page.goto(url);
  await page.evaluate(fastRetry => {
    if (fastRetry) {
      const start = Date.now();
      let checks = 0;
      Date.now = () => start + checks++ * 11000;
    }
    window.__preflight = [];
    globalThis.RavenAssistantCore = {
      normalizeQuestion: value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(),
      detectAdapter: () => ({id: 'generic'}), GENERIC: {profile: {}}, isSensitiveQuestion: () => false
    };
    globalThis.chrome = {runtime: {
      lastError: null,
      onMessage: {addListener: () => {}},
      sendMessage(message, callback) {
        if (message.type === 'raven-preflight-context') callback({title: 'Environment & Prop Artist', company: 'HyperHug'});
        if (message.type === 'raven-preflight-result') window.__preflight.push(message);
      }
    }};
  }, fastRetry);
  await page.evaluate(source);
  await expect.poll(() => page.evaluate(() => window.__preflight.at(-1) || null), {timeout: 12000}).not.toBeNull();
  return page.evaluate(() => window.__preflight.at(-1));
}

test('hidden HyperHug enterprise reCAPTCHA leaves the application ready', async ({page}) => {
  const result = await inspect(page, `
    <script id="recaptchaScript" type="application/json" style="display:none">{}</script>
    <div class="grecaptcha-badge" style="visibility:hidden">
      <div class="grecaptcha-logo" style="visibility:hidden">reCAPTCHA</div>
      <iframe title="reCAPTCHA" width="256" height="60" src="https://www.recaptcha.net/recaptcha/enterprise/anchor?size=invisible"></iframe>
    </div>
    <div class="grecaptcha-error" hidden>Captcha error</div>
    <textarea class="g-recaptcha-response" style="display:none"></textarea>
    <iframe title="recaptcha challenge expires" style="visibility:hidden" width="400" height="580" src="https://www.recaptcha.net/recaptcha/enterprise/bframe"></iframe>`);
  expect(result.status).toBe('ready');
});

test('visible passive reCAPTCHA badge leaves the application ready', async ({page}) => {
  const result = await inspect(page, '<div class="grecaptcha-badge"><iframe title="reCAPTCHA" width="256" height="60" src="https://www.recaptcha.net/recaptcha/enterprise/anchor?size=invisible"></iframe></div>');
  expect(result.status).toBe('ready');
});

test('visible interactive reCAPTCHA anchor requires manual handling', async ({page}) => {
  const result = await inspect(page, '<iframe title="reCAPTCHA" width="304" height="78" src="https://www.recaptcha.net/recaptcha/enterprise/anchor?size=normal"></iframe>');
  expect(result.status).toBe('manual');
  expect(result.reason).toMatch(/challenge or access gate/);
});

test('visible reCAPTCHA challenge frame requires manual handling', async ({page}) => {
  const result = await inspect(page, '<iframe title="recaptcha challenge expires" width="400" height="580" src="https://www.recaptcha.net/recaptcha/enterprise/bframe"></iframe>');
  expect(result.status).toBe('manual');
});

test('visible human verification text requires manual handling', async ({page}) => {
  const result = await inspect(page, '<div>Verify you are human to continue</div>');
  expect(result.status).toBe('manual');
});

test('visible password gate requires manual handling', async ({page}) => {
  const result = await inspect(page, '<label>Password <input type="password"></label>');
  expect(result.status).toBe('manual');
  expect(result.reason).toMatch(/sign-in/);
});

test('hidden password field leaves the application ready', async ({page}) => {
  const result = await inspect(page, '<div style="display:none"><input type="password"></div>');
  expect(result.status).toBe('ready');
});

test('visible logo alt identifies a company absent from body text', async ({page}) => {
  const result = await inspect(page, '<img alt="HyperHug" width="100" height="40" src="/company-logo.png">',
    {formHtml: form.replace('<p>HyperHug</p>', '')});
  expect(result.status).toBe('ready');
});

test('visible back link accessible label identifies a company absent from body text', async ({page}) => {
  const result = await inspect(page, '<a href="/hyperhug" aria-label="Back to HyperHug’s Job Listings" style="display:inline-block;width:100px;height:40px"></a>',
    {formHtml: form.replace('<p>HyperHug</p>', '')});
  expect(result.status).toBe('ready');
});

test('hidden or mismatched company labels cannot satisfy identity', async ({page}) => {
  const result = await inspect(page, `
    <a aria-label="Back to HyperHug’s Job Listings" hidden></a>
    <img alt="HyperHug" style="display:none" width="100" height="40">
    <a aria-label="Back to Another Studio’s Job Listings" style="display:inline-block;width:100px;height:40px"></a>`,
    {formHtml: form.replace('<p>HyperHug</p>', ''), fastRetry: true});
  expect(result.status).toBe('manual');
  expect(result.reason).toMatch(/title or company is not visible/);
});
