ALTER TABLE recipient_profile_versions ADD UNIQUE(id,profile_id);
ALTER TABLE recipient_profiles ADD CONSTRAINT current_version_belongs_to_profile FOREIGN KEY(current_version_id,id) REFERENCES recipient_profile_versions(id,profile_id);
