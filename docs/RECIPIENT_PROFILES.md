# Recipient requirements

Open **Recipients** to see requirements, source evidence, review deadlines and previous versions. Existing reference presets remain unverified; they are not real recipient instructions.

## Record and review a recipient

An administrator chooses **Add recipient**, enters a stable profile key and the recipient's exact electronic address scheme/value, and selects the fields the recipient requires. Use **Requirements unverified** until the source has been reviewed. To choose **Reviewed by your team**, record a source title and URL/document reference, retrieval and review dates, and an explicit review deadline. Confirm that the source applies to this recipient before saving.

The current form configures presence checks for buyer, purchase-order, contract, payment and electronic-address references. It targets XRechnung UBL download. It does not infer tax treatment, execute arbitrary expressions or verify a source automatically. The review is an attributed tenant review, not a public certification. `examples/recipient-profile.json` is an unverified synthetic API example.

Select **New profile version** when instructions change. Earlier versions, hashes, publisher identities and invoice evidence remain intact. A concurrent change is rejected; reopen the current version before publishing. A retired profile is represented by a new version, preserving its history. Tenant profiles cannot replace the shared reference presets or modify another tenant's profiles.

## Check an invoice

In an invoice workspace, select the recipient under **Reference check** and expand **Requirements and evidence**. Validation checks the invoice's electronic address against the profile identifier, its supported output route, effective dates, expiry and required fields. Findings retain source evidence and field locations, including CSV provenance where available.

Coverage and required-field results are separate. Unknown/unverified coverage never becomes verified just because an invoice has all required fields. Download-only workflows may still proceed with unknown or unverified coverage; this is visible and recorded. An expired, retired, superseded, not-yet-effective, mismatched or unsupported-route profile blocks progression when explicitly selected. Choose current applicable requirements and validate again. Approved revisions can be revalidated against a new profile version; changed invoice data still requires a corrected revision.

Approval and generation recheck the selected profile's current version and applicability. Workers recheck before persisting results, including after official validation. Evidence contains the exact profile, hash, version, coverage, check time and requirements result. A later expiry does not rewrite a historical validation or XML. The invoice list shows current coverage; the evidence describes the completed check at its recorded time.

## API

- `GET /api/v1/recipient-profiles`: current tenant profiles plus shared unverified presets.
- `GET /api/v1/recipient-profiles/{recipientKey}`: current version.
- `GET /api/v1/recipient-profiles/{recipientKey}/versions`: immutable history.
- `POST /api/v1/recipient-profiles`: administrator-only publication using `{profile, priorVersionId}`. Use `null` for a new profile and the current version ID for a change.

Caller-controlled tenant IDs, publication identities and public verification statuses are not accepted as authority. Evidence references are recorded as text; the service does not fetch URLs or establish their authenticity. Production OIDC, actual customer evidence approval and delivery remain separate gates.

Profile SHA-256 values cover the stable canonical JSON of the published `profile` input. Version IDs, publisher/timestamp metadata, computed coverage and the compatibility `required` list are returned separately and are excluded from that hash.
