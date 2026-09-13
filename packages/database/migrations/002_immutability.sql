CREATE FUNCTION protect_completed_validation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Immutable validation result'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.revision_id IS DISTINCT FROM OLD.revision_id OR NEW.canonical_sha256 IS DISTINCT FROM OLD.canonical_sha256 OR NEW.rule_manifest_json IS DISTINCT FROM OLD.rule_manifest_json OR NEW.profile_version_id IS DISTINCT FROM OLD.profile_version_id THEN RAISE EXCEPTION 'Immutable validation inputs'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_validation BEFORE UPDATE ON validation_runs FOR EACH ROW EXECUTE FUNCTION protect_completed_validation();
CREATE TRIGGER immutable_approval BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION protect_immutable();
CREATE TRIGGER immutable_profile_version BEFORE UPDATE ON recipient_profile_versions FOR EACH ROW EXECUTE FUNCTION protect_immutable();
CREATE TRIGGER immutable_finding BEFORE UPDATE ON validation_findings FOR EACH ROW EXECUTE FUNCTION protect_immutable();
CREATE TRIGGER immutable_audit BEFORE UPDATE ON audit_events FOR EACH ROW EXECUTE FUNCTION protect_immutable();
ALTER TABLE invoices ADD UNIQUE(tenant_id,id);
ALTER TABLE invoice_revisions ADD UNIQUE(tenant_id,id);
ALTER TABLE source_artifacts ADD UNIQUE(tenant_id,id);
ALTER TABLE validation_runs ADD UNIQUE(tenant_id,id);
ALTER TABLE approvals ADD UNIQUE(tenant_id,id);
ALTER TABLE invoice_revisions ADD FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id);
ALTER TABLE invoice_revisions ADD FOREIGN KEY(tenant_id,source_artifact_id) REFERENCES source_artifacts(tenant_id,id);
ALTER TABLE validation_runs ADD FOREIGN KEY(tenant_id,revision_id) REFERENCES invoice_revisions(tenant_id,id);
ALTER TABLE validation_findings ADD FOREIGN KEY(tenant_id,validation_run_id) REFERENCES validation_runs(tenant_id,id);
ALTER TABLE approvals ADD FOREIGN KEY(tenant_id,revision_id) REFERENCES invoice_revisions(tenant_id,id);
ALTER TABLE approvals ADD FOREIGN KEY(tenant_id,validation_run_id) REFERENCES validation_runs(tenant_id,id);
ALTER TABLE generation_artifacts ADD FOREIGN KEY(tenant_id,revision_id) REFERENCES invoice_revisions(tenant_id,id);
ALTER TABLE generation_artifacts ADD FOREIGN KEY(tenant_id,approval_id) REFERENCES approvals(tenant_id,id);
ALTER TABLE generation_artifacts ADD FOREIGN KEY(tenant_id,validation_run_id) REFERENCES validation_runs(tenant_id,id);
ALTER TABLE evidence_manifests ADD FOREIGN KEY(tenant_id,revision_id) REFERENCES invoice_revisions(tenant_id,id);
ALTER TABLE evidence_manifests ADD FOREIGN KEY(tenant_id,validation_run_id) REFERENCES validation_runs(tenant_id,id);
