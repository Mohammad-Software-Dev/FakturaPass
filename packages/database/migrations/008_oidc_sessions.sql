CREATE TABLE oidc_login_transactions (
  token_sha256 text PRIMARY KEY,
  authority_sha256 text NOT NULL,
  state text NOT NULL,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX oidc_login_expiry ON oidc_login_transactions(expires_at);
CREATE TABLE auth_sessions (
  token_sha256 text PRIMARY KEY,
  authority_sha256 text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  actor_subject text NOT NULL,
  environment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  FOREIGN KEY(tenant_id,actor_subject) REFERENCES memberships(tenant_id,user_subject)
);
CREATE INDEX auth_session_expiry ON auth_sessions(expires_at);
