// Pure scheduling policy. Transport concurrency and deadlines remain collector concerns.
const HOUR = 3600000;
function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}
function positiveLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
const PROVIDER_HOSTS = Object.freeze({
  ashby:'api.ashbyhq.com', greenhouse:'boards-api.greenhouse.io', lever:'api.lever.co',
  workable:'apply.workable.com', smartrecruiters:'api.smartrecruiters.com',
  icims:'jobs.zenimax.com', avature:'jobs.ea.com', jobylon:'cdn.jobylon.com',
  workwithindies:'www.workwithindies.com',
});
function sourceHost(source) {
  // Host grouping is only a scheduling hint, never permission to fetch this URL.
  if (PROVIDER_HOSTS[source.provider]) return PROVIDER_HOSTS[source.provider];
  if (source.provider === 'bamboohr') return `${source.board_key}.bamboohr.com`;
  try { return new URL(source.careers_url).hostname.toLowerCase(); }
  catch { return String(source.provider); }
}

/** Select verified due sources without letting priority starve older work.
 * Rows must include next_check_at, verification_status, enabled, provider,
 * board_key, priority and an id/slug. A bounded DB candidate window must itself
 * order oldest-due first; priority-first preselection defeats this policy.
 */
export function selectDueSources(rows, {now = Date.now(), maxSources = 12, perProvider = 6, perHost = 6} = {}) {
  const clock = timestamp(now);
  if (!Number.isFinite(clock)) throw new TypeError('Invalid scheduling time');
  const limit = positiveLimit(maxSources, 12);
  const providerLimit = positiveLimit(perProvider, 6), hostLimit = positiveLimit(perHost, 6);
  const candidates = (Array.isArray(rows) ? rows : []).filter(source => {
    const due = timestamp(source?.next_check_at);
    return source?.enabled === true && source.verification_status === 'verified'
      && typeof source.provider === 'string' && source.provider !== 'pending'
      && source.provider.trim() !== '' && typeof source.board_key === 'string'
      && source.board_key.trim() !== '' && Number.isFinite(due) && due <= clock;
  }).sort((a, b) => timestamp(a.next_check_at) - timestamp(b.next_check_at)
    || (Number(b.priority) || 0) - (Number(a.priority) || 0)
    || String(a.id || a.slug || '').localeCompare(String(b.id || b.slug || '')));
  const selected = [], providers = new Map(), hosts = new Map(), identities = new Set();
  for (const source of candidates) {
    const identity = source.id || source.slug;
    if (identity && identities.has(identity)) continue;
    const provider = source.provider, host = sourceHost(source);
    if ((providers.get(provider) || 0) >= providerLimit || (hosts.get(host) || 0) >= hostLimit) continue;
    selected.push(source);
    if (identity) identities.add(identity);
    providers.set(provider, (providers.get(provider) || 0) + 1);
    hosts.set(host, (hosts.get(host) || 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

/** Compute the next timestamp only after an actual completed source check.
 * fetched is the total validated vacancy count, not filtered eligible count.
 * Configured intervals take precedence over successful adaptive defaults.
 * failureCount is the count including the failure just recorded.
 */
export function computeNextCheck(source, {status, fetched, failureCount, now = Date.now()} = {}) {
  const clock = timestamp(now);
  if (!Number.isFinite(clock)) throw new TypeError('Invalid scheduling time');
  if (!['ok', 'failed'].includes(status)) throw new TypeError('A completed check status is required');
  const configured = Number.isInteger(source?.interval_hours)
    && source.interval_hours >= 6 && source.interval_hours <= 168 ? source.interval_hours : null;
  let hours;
  if (status === 'ok') {
    hours = configured ?? (Number(source?.priority) >= 3 ? 6 : fetched === 0 ? 168 : 24);
  } else {
    const failures = Number.isInteger(failureCount) && failureCount > 0 ? failureCount
      : Math.max(1, Number(source?.consecutive_failures) + 1 || 1);
    hours = Math.max(configured || 0, Math.min(168, 12 * 2 ** Math.min(4, failures - 1)));
  }
  return new Date(clock + hours * HOUR).toISOString();
}
