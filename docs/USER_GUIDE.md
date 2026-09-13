# From the first import to a finished invoice

FakturaPass gives every invoice a clear path: **import → review → approve → export**. Choose German or English in the top bar, and use the moon/sun button for your preferred appearance. Both choices are remembered without interrupting your work. The stories below use the English button names.

## Maya starts her day with one invoice

Maya has an invoice export from her accounting system. She opens **Import invoice**, chooses the JSON file and clicks **Check preview**. The preview shows both parties, item descriptions, references, payment details and a complete breakdown from line subtotal through discounts, VAT and prepayments to the remaining amount due. She can confirm the document before saving anything. After previewing, grouped fields let her edit the invoice without touching JSON; the source editor remains under **Advanced: edit JSON**.

If she needs to understand the file format, **See a format example** reveals a consulting-invoice template. Its information is explicitly fictional; she replaces it with the appropriate invoice values. The example is optional, and the test-case library is not part of her workspace.

She clicks **Import invoice**. Her document now has its own workspace with an overview, validation results, source data, artifacts and history. Import accepts the documented structured JSON format, up to 1 MiB; PDF and spreadsheet extraction are not available.

## Maya finishes the handoff

Maya selects **Validate**. FakturaPass checks the amounts and official XRechnung rules in the background. She can follow the status without losing her place. Once the revision is technically valid, she selects **Approve revision**, then **Generate XRechnung**.

When the generated file has passed official validation, **Download XML** becomes available. In **Artifacts & evidence**, she also downloads the evidence manifest containing checksums, rule versions, findings and the original validator report. A completion message explains that the invoice has not been sent. She now has the file and the record of how it was checked, ready for her organization's chosen delivery channel. FakturaPass provides downloads; it does not send the invoice.

## Jonas resolves a discrepancy without starting over

Jonas notices **Errors found** on an invoice. In **Validation results**, the declared total and calculated total sit side by side. He selects the affected field to jump directly to **Source & data**, where the relevant value is highlighted.

He chooses **Corrected revision**, edits the relevant fields and checks the preview. A before-and-after summary highlights every changed value. After changing quantities or prices, **Recalculate amounts** updates line totals, tax and the remaining balance using the stated adjustment bases. Imported figures are never silently recalculated. Jonas reviews the amounts, then selects **Save new revision**. **Cancel and return to invoice** leaves the saved revision unchanged. The original stays intact. Jonas validates the new revision, approves it and generates its XML. He never needs to delete an earlier record to make progress.

A missing field or invalid JSON can be resolved even earlier: **Check preview** explains the problem before import. The editor keeps his input while he corrects it. If he imports an already-recorded source, **Open existing invoice** takes him straight to the existing invoice; a correction belongs there, rather than in a duplicate record.

## Leila prepares the reference her recipient expects

Leila knows an order reference is required for the handoff. Under **Reference check**, she chooses **Purchase order reference** before validation. The other presets check buyer and contract references. The app identifies missing references separately from official technical findings.

Leila obtains the correct reference, adds it through a corrected revision and validates again. If she changes the selected reference check, she revalidates before approval. These presets check the selected fields; they are not verified recipient-specific requirements. **Requirements unverified** keeps that distinction visible, and **Recipient unknown** means no verified recipient requirements are available.

## Amira reviews the work with confidence

At the end of the day, Amira searches by invoice number, recipient or source ID and narrows the list by status or validation result. She opens an invoice and uses:

- **Overview** for parties, references, line items and totals.
- **Validation results** for the issues that need attention and the completed checks.
- **Source & data** to inspect or copy the selected revision's JSON and checksums.
- **Artifacts & evidence** for available XML and evidence downloads.
- **History** to inspect prior revisions, validation runs and approvals.

Opening an earlier revision does not make it editable. **Open current revision** brings her back to the version she can act on. Approval always belongs to the exact validated revision, so changed data needs a new validation and approval. Language and appearance changes never alter invoice content or stored evidence.

## Oliver handles an exception without losing the invoice

An unsupported tax case arrives. The app clearly marks it **Unsupported**, explains the restriction and keeps approval unavailable. Oliver retains the findings for review instead of altering tax information just to obtain a pass. Completed failed checks can still provide evidence.

On another day, the validation service is temporarily unavailable. The invoice and durable job remain stored. After the service is restored, the worker retries the job; Oliver does not need to reimport. A page-level failure offers **Try again** and a route back to the workspace. Operators can follow OPERATIONS.md for service recovery.

## Know what is available

**Settings & information** explains the supported scope first. **Technical information** opens only when version or installation details are needed.

The current build supports ordinary German domestic invoices in EUR with explicitly supplied 19% standard VAT. Other tax cases, reduced rates, credit notes, Peppol delivery and ZUGFeRD are not enabled. Technical validation does not guarantee recipient acceptance or tax correctness. Production identity, hosting and operational readiness remain separate deployment requirements described in the repository documentation.
