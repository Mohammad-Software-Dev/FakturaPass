# CSV batch import

Choose **Import → CSV batch**, select a saved mapping, upload your UTF-8 export and choose **Check CSV preview**. Each row represents one invoice line; the mapping's grouping column identifies the invoice. Expand each invoice to review parties, references, line items, tax and totals before saving.

A preview checks the schema and arithmetic. It does not run official XRechnung validation. **Import all invoices** saves the valid batch atomically. A failed batch saves nothing; fix the indicated row and column in the export and preview again. After import, open each invoice to edit through a corrected revision, validate, approve and generate its XML. The app does not send invoices.

## Supported input

- UTF-8, including a preserved UTF-8 BOM; comma or semicolon separator explicitly set by the mapping.
- Quoted fields, escaped double quotes, CRLF/LF and embedded newlines.
- Up to 512 KiB, 1,000 data records, 150 columns and 100 invoices per batch.
- An exact, ordered header fingerprint. Missing, renamed, duplicate or reordered headers require a corrected export or a new mapping version.
- Explicit decimal separator per numeric column; thousands separators are rejected. IDs remain strings, including leading zeros. Declared amounts are never silently recalculated.
- Repeated invoice-level values must agree across an invoice's rows. Row references count logical CSV records, starting at 2 for the first data record; a quoted multiline cell remains one record.

The supplied `examples/customer-invoices.csv` and `examples/csv-recipe.json` are synthetic fixtures for two invoices with three lines each. They exercise the existing domestic EUR/19% VAT support boundary; they are not a verified customer export mapping.

## Internal mapping registration

Mappings are tenant-scoped, immutable versions, registered by an operator with database access:

```sh
npm run mapping:register -- TENANT_ID RECIPE.json SAMPLE.csv
```

Registration requires a sample that passes the dry run. Use a new version for changes; an existing version cannot be overwritten. This initial mapping subset supports explicit source columns, literal constants and decimal normalization. There is no inference, executable expression, external lookup, date conversion or automatic tax selection. Customer mapping acceptance and official validation remain separate requirements.

The canonical target uses dotted paths and `lines[].field` for each row's line. Conflicting/overlapping targets and unsafe property names are rejected. Source columns and explicit constants are recorded in provenance; constants use row 0 and transform `literal/1`. Structural empty line adjustments are supplied by this bounded importer.

## Integrity and API

`GET /api/v1/mapping-recipes` lists the current tenant's versions. `POST /api/v1/csv/preview` takes `csv`, `recipeId` and `recipeVersion`. `POST /api/v1/csv/import` also requires the returned `sourceSha256`, `recipeSha256` and an `Idempotency-Key` header. The server reruns the preview, checks both hashes and commits in one transaction. Repeating an identical request returns its original result. Existing source identities link to their existing invoices instead of producing duplicates.

Each imported invoice retains the complete original CSV bytes, its grouped rows, full recipe/version/hash and field provenance in the source artifact. Evidence includes that mapping record. Later validation findings link back to mapped source fields where available. A corrected JSON revision preserves the original CSV revision and its evidence in history.
