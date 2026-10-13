// JWT signature/issuer/audience verification is delegated to the pinned JOSE library.
// OIDC identity scopes do not grant Raven permissions: each client has an explicit grant.
export const OAUTH_SCOPES = ['email'];
export class OAuthError extends Error {
  constructor(code, status = 401) { super(code); this.status = status; }
}
const check = (condition, code = 'UNAUTHORIZED', status = 401) => {
  if (!condition) throw new OAuthError(code, status);
};
export function oauthConfiguration(getEnv) {
  const base = getEnv('SUPABASE_URL');
  if (!base) return null;
  const url = new URL(base);
  check(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/', 'SERVER_NOT_CONFIGURED', 503);
  const resource = url.origin + '/functions/v1/raven-mcp-v1';
  return {issuer: url.origin + '/auth/v1', resource,
    metadataUrl: resource + '/.well-known/oauth-protected-resource',
    jwksUrl: url.origin + '/auth/v1/.well-known/jwks.json'};
}
export function oauthMetadata(config) {
  return {resource: config.resource, authorization_servers: [config.issuer],
    scopes_supported: OAUTH_SCOPES, bearer_methods_supported: ['header'],
    resource_documentation: 'https://github.com/shipitmyguy-ux/raven/blob/main/docs/RAVEN_MCP_BRIDGE.md'};
}
export function oauthChallenge(config) {
  return `Bearer resource_metadata="${config.metadataUrl}", scope="email", error="invalid_token", error_description="Sign in and authorize Raven access"`;
}
export function createOAuthAuthenticator({getEnv, verifyJwt, loadGrant, now = () => Date.now()}) {
  return async req => {
    const config = oauthConfiguration(getEnv);
    check(config && verifyJwt, 'SERVER_NOT_CONFIGURED', 503);
    const value = req.headers.get('authorization') || '';
    check(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) && value.length <= 16000);
    let payload;
    try {
      ({payload} = await verifyJwt(value.slice(7), config, {
        issuer: config.issuer, audience: config.resource, algorithms: ['ES256', 'RS256'],
        requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat', 'client_id', 'session_id'],
        currentDate: new Date(now()), clockTolerance: 0
      }));
    } catch { throw new OAuthError('UNAUTHORIZED'); }
    check(payload.role === 'authenticated' && payload.is_anonymous !== true &&
      typeof payload.sub === 'string' && payload.sub &&
      typeof payload.client_id === 'string' && payload.client_id &&
      typeof payload.session_id === 'string' && payload.session_id &&
      Number.isFinite(payload.iat) && payload.iat <= now() / 1000 &&
      Number.isFinite(payload.exp) && payload.exp > now() / 1000);
    let grant;
    // Explicit environment configuration remains authoritative; never fall back on an invalid grant.
    if (getEnv('RAVEN_MCP_OWNER_SUBJECT') || getEnv('RAVEN_MCP_OAUTH_GRANTS')) {
      check(payload.sub === getEnv('RAVEN_MCP_OWNER_SUBJECT'));
      let grants;
      try { grants = JSON.parse(getEnv('RAVEN_MCP_OAUTH_GRANTS') || '[]'); }
      catch { throw new OAuthError('SERVER_NOT_CONFIGURED', 503); }
      check(Array.isArray(grants), 'SERVER_NOT_CONFIGURED', 503);
      grant = grants.find(g => g && g.client_id === payload.client_id && g.subject === payload.sub);
    } else if (loadGrant) {
      try { grant = await loadGrant(payload); }
      catch { throw new OAuthError('SERVER_NOT_CONFIGURED', 503); }
    }
    const permissions = ['jobs:read', 'profile:read', 'documents:create', 'documents:revise'];
    check(grant && grant.subject === payload.sub && grant.client_id === payload.client_id &&
      Number.isFinite(Date.parse(grant.expires_at)) && Date.parse(grant.expires_at) > now() &&
      Array.isArray(grant.job_ids) && grant.job_ids.length > 0 && grant.job_ids.length <= 200 &&
      grant.job_ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id)) &&
      Array.isArray(grant.scopes) && grant.scopes.length > 0 && grant.scopes.every(s => permissions.includes(s)));
    // Re-read grants on every request so grant removal immediately revokes bridge access.
    return {subject: payload.sub, client_id: payload.client_id, job_ids: grant.job_ids, scopes: grant.scopes};
  };
}
