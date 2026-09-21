CREATE TABLE support_agents (
  id text PRIMARY KEY,
  actor_subject text NOT NULL,
  authority_sha256 text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(authority_sha256,actor_subject)
);
CREATE TABLE support_agent_events (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES support_agents(id),
  action text NOT NULL CHECK(action IN ('REGISTER','SUSPEND')),
  actor_subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_support_agent_events BEFORE UPDATE OR DELETE ON support_agent_events FOR EACH ROW EXECUTE FUNCTION protect_immutable();
CREATE TABLE support_grants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  agent_id text NOT NULL REFERENCES support_agents(id),
  authority_sha256 text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('LOCAL','SANDBOX','PILOT','PRODUCTION')),
  invoice_id text NOT NULL REFERENCES invoices(id),
  revision_id text NOT NULL REFERENCES invoice_revisions(id),
  scope text NOT NULL DEFAULT 'INVOICE_DIAGNOSIS' CHECK(scope='INVOICE_DIAGNOSIS'),
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,user_subject)
);
CREATE INDEX support_grants_agent ON support_grants(agent_id,expires_at);
CREATE INDEX support_grants_tenant ON support_grants(tenant_id,created_at);
