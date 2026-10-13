// Presentation-only deduplication; original database rows remain untouched.
const OFFICIAL = new Set(['ashby','greenhouse','lever','workable','smartrecruiters','bamboohr','icims','avature','jobylon','teamtailor','breezy','recruitee']);
const BOARDS = new Set(['workwithindies','remotegamejobs','artstation','blenderartists','epicforum','hitmarker','eightbit','skillsearch','gamesjobsdirect']);
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function employer(value) {
  const name=normalize(value), alias=name.replace(/[\s-]/g,'');
  if (['halfmermaid','halfmermaidproductions'].includes(alias)) return 'half mermaid';
  if (alias==='smilebreak') return 'smile break';
  if (!name || /\b(?:undisclosed|unknown)\s+client\b/.test(name) || /^(?:undisclosed|unknown)\b/.test(name) || /^(?:unknown(?: employer)?|unspecified|confidential|anonymous|indie studio|studio|company|n\/a)$/.test(name)) return '';
  return name;
}
function provider(row) {
  const match=/^Studio:([a-z]+)$/.exec(String(row?.source || ''));
  return match && (OFFICIAL.has(match[1]) || BOARDS.has(match[1])) ? match[1] : '';
}
// Exact board-to-employer posting evidence: docs/board-duplicate-identities.json.
// These aliases waive only location phrasing equality, never employer/title/remote.
const VERIFIED_POSTINGS = new Map([
  [
    "https://www.workwithindies.com/careers/half-mermaid-environment-artist",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125496-environment-artist",
      "company": "half mermaid",
      "title": "environment artist",
      "provider": "workwithindies"
    }
  ],
  [
    "https://remotegamejobs.com/jobs/half-mermaid-productions-environment-artist-remote-job",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125496-environment-artist",
      "company": "half mermaid",
      "title": "environment artist",
      "provider": "remotegamejobs"
    }
  ],
  [
    "https://www.workwithindies.com/careers/half-mermaid-senior-environment-artist",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125495-senior-environment-artist",
      "company": "half mermaid",
      "title": "senior environment artist",
      "provider": "workwithindies"
    }
  ],
  [
    "https://remotegamejobs.com/jobs/half-mermaid-productions-senior-environment-artist-remote-job-f3701dac-2485-4691-bb10-3933a0b0337b",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125495-senior-environment-artist",
      "company": "half mermaid",
      "title": "senior environment artist",
      "provider": "remotegamejobs"
    }
  ],
  [
    "https://www.artstation.com/jobs/QKn9",
    {
      "posting": "https://www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13",
      "company": "smile break",
      "title": "senior environment artist",
      "provider": "artstation"
    }
  ],
  [
    "https://remotegamejobs.com/jobs/smile-break-senior-environment-artist-remote-job",
    {
      "posting": "https://www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13",
      "company": "smile break",
      "title": "senior environment artist",
      "provider": "remotegamejobs"
    }
  ],
  [
    "https://hitmarker.net/jobs/hyperhug-3d-artist-weapon-skins-4737280",
    {
      "posting": "https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8",
      "company": "hyperhug",
      "title": "3d artist (weapon skins)",
      "provider": "hitmarker"
    }
  ],
  [
    "https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8",
    {
      "posting": "https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8",
      "company": "hyperhug",
      "title": "3d artist (weapon skins)",
      "provider": "ashby"
    }
  ]
]);
function identity(row) {
  const company=employer(row.company), title=normalize(row.title), location=normalize(row.location);
  // Unknown remote status or geography cannot establish compatible constraints.
  if (!company || !title || !location || typeof row.remote!=='boolean') return '';
  const posting=VERIFIED_POSTINGS.get(row.url);
  if (posting) {
    if (company!==posting.company || title!==posting.title || provider(row)!==posting.provider) return '';
    return JSON.stringify(['verified-posting',posting.posting,company,title,row.remote]);
  }
  return JSON.stringify([company,title,location,row.remote]);
}
function better(a,b) {
  const officialA=OFFICIAL.has(provider(a)), officialB=OFFICIAL.has(provider(b));
  if (officialA!==officialB) return officialB ? b : a;
  return String(b.snippet || '').length > String(a.snippet || '').length ? b : a;
}
export function deduplicateStudioResults(rows) {
  const groups=new Map();
  for (const row of rows) {
    const source=provider(row), key=source && identity(row);
    if (!key) continue;
    const group=groups.get(key) || [];
    group.push(row);groups.set(key,group);
  }
  const replacements=new Map(), hidden=new Set();
  for (const group of groups.values()) {
    const providers=new Set(group.map(provider));
    // More than one posting on one provider makes cross-provider identity
    // ambiguous: retain the entire group rather than guess which job matches.
    if (group.length<2 || providers.size!==group.length) continue;
    const winner=group.reduce(better);
    replacements.set(group[0],winner);
    for (const row of group.slice(1)) hidden.add(row);
  }
  return rows.filter(row=>!hidden.has(row)).map(row=>replacements.get(row) || row);
}
