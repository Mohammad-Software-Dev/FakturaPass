# A working day with FakturaPass

FakturaPass is a local workspace for reviewing synthetic German invoices in EUR, validating XRechnung rules, approving a revision and downloading its XML and evidence. It does not send invoices. Start the local stack with `npm run dev`, then open http://127.0.0.1:3010. The stories below use the English interface; choose English in the language selector to follow the button names exactly.

## 1. Anna makes the workspace her own

Anna opens FakturaPass in the morning. She chooses English in the top bar and uses the moon button to turn on dark appearance. Deep green panels replace the ivory surfaces. Later, the sun button brings back light appearance. Her choices survive a reload, and changing either preference while editing does not discard her draft. On a small screen, the same controls remain in the top bar; the appearance button becomes an icon with an accessible label.

Before doing any work, Anna visits **Settings & information**. She sees the pinned validator and supported scope. This release supports ordinary domestic German invoices in EUR with explicitly supplied 19% standard VAT. Reduced VAT, other tax treatments, credit notes, ZUGFeRD and delivery are not enabled. The local workspace uses a demo administrator identity and synthetic data.

## 2. Her first invoice becomes an XRechnung

Anna selects **Import invoice**. She can choose a JSON file, paste canonical JSON, or choose a supplied **Demo template**. For a first run she picks **Standard invoice · 19% VAT**. **Check preview** shows the recipient, amount, date and source identity. This preview checks the input structure; it is not the final invoice validation.

She selects **Import invoice**, then **Validate** in the invoice workspace. The background job checks monetary consistency and the real official XRechnung rules. When the revision is technically valid, **Approve revision** becomes available. Approval binds that exact revision to its validation and chosen recipient profile. She then selects **Generate XRechnung**. After the generated XML passes official validation, **Download XML** appears.

In **Artifacts & evidence**, Anna downloads the evidence manifest as well. It records checksums, rule versions, findings and the original validator report. These are downloads for a later handoff; FakturaPass has not sent the invoice or confirmed that a recipient will accept it.

## 3. A missing field stops the import

Ben pastes JSON with a missing seller electronic address. **Check preview** identifies `seller.electronicAddress` and explains that a required field is missing. If his JSON has invalid syntax or exceeds 1 MiB, he sees that error before importing.

He corrects the JSON and checks the preview again. The editor expects the supplied canonical schema, including monetary values as decimal strings. It does not convert an arbitrary PDF, spreadsheet or accounting export into an invoice. He uses the demo JSON as a structural example and supplies the actual synthetic values himself.

## 4. A one-cent difference leads to a new revision

Clara imports **Mismatched invoice total** and selects **Validate**. The revision shows **Errors found**, and approval is unavailable. In **Validation results**, she compares the declared and calculated amounts. A field link opens **Source & data**, highlights the affected field and shows the immutable canonical JSON. **Technical details** retains the original diagnostic and rule information.

Clara selects **Corrected revision**, edits the JSON and fixes the relevant values consistently. **Check preview**, followed by **Save new revision**, creates a new revision. The original is retained; it is not overwritten. She validates the new revision and approves it only after it passes.

In **History**, she opens the earlier revision to inspect what changed. Historical revisions are read-only. **Open current revision** returns her to the version she can validate or approve. A corrected revision needs its own validation and approval; an old approval cannot authorize changed data.

## 5. A technically valid invoice still needs a reference

David knows the synthetic recipient requires an order reference. Before validation he chooses **Demo · Purchase order reference** from **Recipient profile**. Other examples cover a buyer reference or contract reference. Missing required references appear separately from official technical findings.

He obtains and explicitly adds the missing reference in a corrected revision, then validates against the same profile. If he changes profiles, he runs validation again before approving. With no selected profile, **Recipient unknown** means the recipient's requirements are unverified; an official technical pass does not change that. The supplied profiles are demos, not verified customer requirements.

## 6. An unsupported case stays blocked

Eva imports **Unsupported VAT treatment**. The workspace marks it **Unsupported** and explains the restriction. She cannot approve or generate it. She does not change its tax category merely to get a green result: that would misrepresent the invoice. The case needs support and domain review beyond this release.

Completed failed validations can still have downloadable evidence. Eva keeps the findings for review without treating them as a valid invoice artifact.

## 7. A second import and an interrupted service

Farid accidentally imports the same source again. FakturaPass reports that the source already exists. He finds the existing invoice and uses **Corrected revision** if the data needs changing, preserving the source identity. Integrations can also replay the same idempotency key and body without creating duplicate invoices; changing a body under the same key produces a conflict.

Later, the validation service becomes unavailable during a job. The stored invoice remains intact and the durable job is retryable. After the local service is restored, the worker retries it; an expired worker lease can also be recovered. Farid does not reimport to recover a technical failure. If needed, the operator follows OPERATIONS.md to restart the engine or worker. Unexpected page errors have **Try again** and a route back to the workspace.

## 8. The afternoon audit

Greta returns to **All invoices**, searches by invoice number, recipient or source ID, and narrows the list by status or validation result. She refreshes the list when needed and opens a record.

**Overview** gives her the parties, references, line items, totals and validation status. **Validation results** separates consistency, official standards, recipient requirements and system issues. **Source & data** exposes the selected revision's JSON and SHA-256 hashes, with **Copy JSON** for inspection. **Artifacts & evidence** provides available XML and evidence downloads. **History** lets her inspect earlier revisions, validation runs and approvals.

She switches back to German for a colleague. Labels, explanations, dates and amounts change; the supplied invoice text, identifiers, XML bytes and archived evidence do not. Original external diagnostics remain labelled as unchanged technical evidence. Her audit trail is the same in either language and either appearance.
