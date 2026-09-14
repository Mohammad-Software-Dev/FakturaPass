CREATE TABLE review_assignments (
 tenant_id text NOT NULL REFERENCES tenants(id),
 invoice_id text NOT NULL,
 owner_subject text,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,invoice_id),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id)
);
