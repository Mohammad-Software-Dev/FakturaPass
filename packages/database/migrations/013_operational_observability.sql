ALTER TABLE jobs ADD COLUMN environment text;
UPDATE jobs j SET environment=i.environment FROM invoices i WHERE i.id=j.payload_json->>'invoiceId' AND i.tenant_id=j.tenant_id;
UPDATE jobs SET environment='LOCAL' WHERE environment IS NULL;
ALTER TABLE jobs ALTER COLUMN environment SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN environment SET DEFAULT 'LOCAL';
ALTER TABLE jobs ADD CONSTRAINT job_environment CHECK(environment IN ('LOCAL','SANDBOX','PILOT','PRODUCTION'));
CREATE INDEX job_environment_claim ON jobs(environment,state,available_at);
CREATE TABLE worker_heartbeats (
  id text PRIMARY KEY,
  environment text NOT NULL CHECK(environment IN ('LOCAL','SANDBOX','PILOT','PRODUCTION')),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE job_metrics (
  environment text NOT NULL,
  job_type text NOT NULL CHECK(job_type IN ('VALIDATE','GENERATE','OTHER')),
  outcome text NOT NULL CHECK(outcome IN ('PASSED','REJECTED','RETRY','RECOVERED')),
  attempts bigint NOT NULL DEFAULT 0,
  duration_ms double precision NOT NULL DEFAULT 0,
  PRIMARY KEY(environment,job_type,outcome)
);
