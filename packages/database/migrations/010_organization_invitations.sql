CREATE TABLE organization_invitations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  authority_sha256 text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK(role IN ('ADMIN','OPERATOR','APPROVER','READ_ONLY')),
  token_sha256 text NOT NULL UNIQUE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REVOKED')),
  accepted_by text,
  accepted_at timestamptz,
  FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_subject)
);
CREATE UNIQUE INDEX invitation_pending_email ON organization_invitations(tenant_id,email) WHERE status='PENDING';
ALTER TABLE oidc_login_transactions ADD COLUMN invitation_id text REFERENCES organization_invitations(id);
