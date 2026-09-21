CREATE TABLE api_credentials (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  owner_subject text NOT NULL,
  authority_sha256 text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('LOCAL','SANDBOX','PILOT','PRODUCTION')),
  name text NOT NULL,
  scopes text[] NOT NULL,
  token_sha256 text NOT NULL UNIQUE,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  FOREIGN KEY (tenant_id,owner_subject) REFERENCES memberships(tenant_id,user_subject)
);
CREATE INDEX api_credentials_tenant ON api_credentials(tenant_id);
