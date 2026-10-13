// Public ATS payload normalization, shared by the collector and Node regression tests.
export const MAX_STUDIO_JOBS = 1000;
const clean = (value,limit=5000) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim().slice(0, limit);
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
    case 'bamboohr':
      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(boardKey))) throw Error('Bad BambooHR board ID');
      return `https://${boardKey}.bamboohr.com/careers/list`;
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
export function providerDetailEndpoint(provider, boardKey, jobId) {
  providerEndpoint(provider, boardKey); // Validate board identifier before building a fixed-origin request.
  if (provider === 'bamboohr') {
    if (!/^[1-9][0-9]{0,15}$/.test(String(jobId))) throw Error('Bad job ID');
    return `https://${boardKey}.bamboohr.com/careers/${jobId}/detail`;
  }
  if (provider === 'smartrecruiters') {
    if (!/^[a-zA-Z0-9-]{1,90}$/.test(String(jobId))) throw Error('Bad job ID');
    return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(boardKey)}/postings/${encodeURIComponent(jobId)}`;
  }
  throw Error('Unsupported detail provider');
}
export function providerDetailRecord(provider, data, jobId) {
  if (provider === 'bamboohr') {
    const record = data?.result?.jobOpening;
    if (!record || typeof record !== 'object' || Array.isArray(record) || !record.jobOpeningName || !record.jobOpeningStatus) throw Error('Unexpected provider detail');
    if (record.jobOpeningStatus !== 'Open') throw Error('Provider job is no longer open');
    const url = canonicalStudioUrl(record.jobOpeningShareUrl);
    if (!url || new URL(url).pathname !== `/careers/${jobId}`) throw Error('Provider detail job mismatch');
    return {...record, id: String(jobId)};
  }
  if (provider === 'smartrecruiters' && data && typeof data === 'object' && !Array.isArray(data) && String(data.id) === String(jobId)) return data;
  throw Error('Unexpected provider detail');
}
export function sourceJobAllowed(source, record) {
  const scope = source.job_scope;
  if (scope == null) return true;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || !['department','company','title','organization'].includes(scope.field) || !Array.isArray(scope.values) || !scope.values.length || scope.values.length > 20 || scope.values.some(v => typeof v !== 'string' || !v.trim() || v.length > 200)) throw Error('Invalid studio job scope');
  const values = scope.field === 'organization' ? (Array.isArray(record.customField) ? record.customField.filter(v => v?.fieldLabel === 'Organizational Unit').map(v => v?.valueLabel) : []) : scope.field === 'department' ? [record.departmentLabel, record.department?.label, record.department?.name, record.department, record.categories?.department, ...(Array.isArray(record.departments) ? record.departments.map(v => v?.name) : [])] : scope.field === 'company' ? [record.company?.name, record.company?.identifier, record.company] : [record.title, record.name, record.text, record.jobOpeningName];
  const allowed = new Set(scope.values.map(v => v.trim().toLowerCase()));
  return values.some(v => typeof v === 'string' && allowed.has(v.trim().toLowerCase()));
}
function address(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value.fullLocation === 'string' && value.fullLocation) return value.fullLocation;
  return [value.city, value.region || value.state, value.country?.name || value.country].filter(x => typeof x === 'string' && x).join(', ') || String(value.name || '');
}
export function providerRecords(provider, data) {
  const records = provider === 'bamboohr' ? data?.result : provider === 'lever' ? data : provider === 'smartrecruiters' ? data?.content : data?.jobs;
  if (!Array.isArray(records)) throw Error('Unexpected provider response');
  return records;
}
export function normalizeStudioJobs(source, data) {
  sourceJobAllowed(source, {}); // Validate configured scope even for an empty provider response.
  if (source.provider === 'bamboohr') providerEndpoint(source.provider, source.board_key);
  const jobs = providerRecords(source.provider, data).filter(x => x && typeof x === 'object' && sourceJobAllowed(source, x)).map(x => {
    const title = clean(x.title || x.text || x.name || x.jobOpeningName);
    let location = address(x.location) || String(x.categories?.location || '');
    if (source.provider === 'workable') {
      location = Array.isArray(x.locations) && x.locations.length ? x.locations.map(address).filter(Boolean).join('; ') : address(x);
    }
    if (source.provider === 'bamboohr') location = address(x.atsLocation) || address(x.location);
    const bambooTitleRemote = source.provider === 'bamboohr' && /(?:\(remote\)|[-–—]\s*remote|\bremote\s+or\s+on[- ]site)\s*$/i.test(title);
    const remote = bambooTitleRemote || x.isRemote === true || x.telecommuting === true || x.location?.remote === true || /remote/i.test(String(x.workplaceType || '')) || /\bremote\b/i.test(location);
    let jobUrl = x.jobUrl || x.absolute_url || x.hostedUrl || x.shortlink || x.url || x.postingUrl || x.jobOpeningShareUrl;
    if (source.provider === 'bamboohr' && /^[1-9][0-9]{0,15}$/.test(String(x.id || ''))) jobUrl = `https://${source.board_key}.bamboohr.com/careers/${x.id}`;
    // SmartRecruiters list responses expose API refs, not always the public posting URL.
    if (source.provider === 'smartrecruiters' && !jobUrl && /^[a-zA-Z0-9-]+$/.test(String(x.id || ''))) jobUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(source.board_key)}/${encodeURIComponent(x.id)}`;
    const url = source.provider === 'bamboohr' && !/^[1-9][0-9]{0,15}$/.test(String(x.id || '')) ? '' : canonicalStudioUrl(jobUrl);
    const sections = x.jobAd?.sections;
    let description = sections ? Object.values(sections).map(v => v?.text || '').join(' ') : x.descriptionPlain || x.descriptionHtml || x.content || x.description;
    if(source.provider==='lever'){
      const main=[x.descriptionPlain,x.descriptionHtml,x.description].filter(v=>typeof v==='string').map(v=>clean(v,20000)).sort((a,b)=>b.length-a.length)[0]||'';
      const parts=[main];
      for(const section of Array.isArray(x.lists)?x.lists:[]){const text=clean([section.text,section.content].filter(Boolean).join(' '),20000);if(text&&!parts.some(p=>p.includes(text)))parts.push(text);}
      const additional=clean(x.additional||x.additionalPlain,20000);if(additional&&!parts.some(p=>p.includes(additional)))parts.push(additional);
      description=parts.join(' ');
    }
    return { provider_job_id: String(x.id || ''), title, company: source.studio_name, location, remote, url, snippet: clean(description,20000), posted_at: String(x.publishedAt || x.updated_at || x.published_on || x.releasedDate || x.datePosted || '') };
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
