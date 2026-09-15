ALTER TABLE memberships ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version > 0);
ALTER TABLE memberships ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE memberships ADD CONSTRAINT membership_subject_unique UNIQUE(tenant_id,user_subject);
ALTER TABLE memberships ADD CONSTRAINT membership_role_valid CHECK(role IN ('ADMIN','OPERATOR','APPROVER','READ_ONLY'));
ALTER TABLE memberships ADD CONSTRAINT membership_status_valid CHECK(status IN ('ACTIVE','SUSPENDED'));
CREATE INDEX membership_active_tenant ON memberships(tenant_id,status,role);
