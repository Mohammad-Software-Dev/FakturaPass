-- A verified identity may choose among active memberships; no implicit tenant for multi-workspace sign-in.
ALTER TABLE auth_sessions ALTER COLUMN tenant_id DROP NOT NULL;
