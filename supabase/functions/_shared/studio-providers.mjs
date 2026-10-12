// Public ATS payload normalization, shared by the collector and Node regression tests.
export const MAX_STUDIO_JOBS = 1000;
const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim().slice(0, 5000);
export function canonicalStudioUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
    return u.toString();
  } catch { return ''; }
}
export function providerEndpoint(provider, boardKey, offset = 0) {
  if (!/^[a-zA-Z0-9_-]{2,90}$/.test(String(boardKey))) throw Error('Bad board ID');
  const k = encodeURIComponent(boardKey);
  switch (provider) {
    case 'ashby': return `https://api.ashbyhq.com/posting-api/job-board/${k}`;
    case 'greenhouse': return `https://boards-api.greenhouse.io/v1/boards/${k}/jobs?content=true`;
    case 'lever': return `https://api.lever.co/v0/postings/${k}?mode=json`;
    case 'workable': return `https://apply.workable.com/api/v1/widget/accounts/${k}?details=true`;
    case 'smartrecruiters':
      if (!Number.isInteger(offset) || offset < 0) throw Error('Bad page offset');
      return `https://api.smartrecruiters.com/v1/companies/${k}/postings?limit=100&offset=${offset}`;
    default: throw Error('Unsupported provider');
  }
}
function address(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value.fullLocation === 'string' && value.fullLocation) return value.fullLocation;
  return [value.city, value.region || value.state, value.country?.name || value.country].filter(x => typeof x === 'string' && x).join(', ') || String(value.name || '');
}
export function providerRecords(provider, data) {
  const records = provider === 'lever' ? data : provider === 'smartrecruiters' ? data?.content : data?.jobs;
  if (!Array.isArray(records)) throw Error('Unexpected provider response');
  return records;
}
export function normalizeStudioJobs(source, data) {
  const jobs = providerRecords(source.provider, data).filter(x => x && typeof x === 'object').map(x => {
    const title = clean(x.title || x.text || x.name);
    let location = address(x.location) || String(x.categories?.location || '');
    if (source.provider === 'workable') {
      location = Array.isArray(x.locations) && x.locations.length ? x.locations.map(address).filter(Boolean).join('; ') : address(x);
    }
    const remote = x.isRemote === true || x.telecommuting === true || x.location?.remote === true || /remote/i.test(String(x.workplaceType || '')) || /\bremote\b/i.test(location);
    let jobUrl = x.jobUrl || x.absolute_url || x.hostedUrl || x.shortlink || x.url || x.postingUrl;
    // SmartRecruiters list responses expose API refs, not always the public posting URL.
    if (source.provider === 'smartrecruiters' && !jobUrl && /^[a-zA-Z0-9-]+$/.test(String(x.id || ''))) jobUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(source.board_key)}/${encodeURIComponent(x.id)}`;
    const url = canonicalStudioUrl(jobUrl);
    const sections = x.jobAd?.sections;
    const description = sections ? Object.values(sections).map(v => v?.text || '').join(' ') : x.descriptionPlain || x.descriptionHtml || x.content || x.description;
    return { title, company: source.studio_name, location, remote, url, snippet: clean(description), posted_at: String(x.publishedAt || x.updated_at || x.published_on || x.releasedDate || '') };
  }).filter(j => j.title && j.url);
  return deduplicateStudioJobs(jobs);
}
export function deduplicateStudioJobs(jobs) {
  const unique = new Map();
  for (const job of jobs) {
    const existing = unique.get(job.url);
    if (!existing) { unique.set(job.url, job); continue; }
    const locations = [...new Set([existing.location, job.location].flatMap(x => x.split('; ')).filter(Boolean))];
    existing.location = locations.join('; ');
    existing.remote ||= job.remote;
    if (!existing.snippet) existing.snippet = job.snippet;
  }
  return [...unique.values()];
}
