ALTER TABLE recipient_profiles ADD COLUMN current_version_id text REFERENCES recipient_profile_versions(id);
CREATE UNIQUE INDEX recipient_tenant_key ON recipient_profiles(tenant_id,recipient_key);
ALTER TABLE recipient_profile_versions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE recipient_profile_versions ADD COLUMN created_by text;
CREATE UNIQUE INDEX recipient_version_number ON recipient_profile_versions(profile_id,version);
CREATE TRIGGER immutable_profile_delete BEFORE DELETE ON recipient_profile_versions FOR EACH ROW EXECUTE FUNCTION protect_immutable();
ALTER TABLE validation_runs ADD COLUMN recipient_snapshot jsonb;
