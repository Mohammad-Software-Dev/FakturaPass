# ADR 0010 — Local recipient profile milestone

Status: implemented within the user's instruction to proceed with the next documented milestone.

FP-009 extends the Release A preset implementation using the existing recipient tables and the authoritative profile contract. Tenant administrators publish immutable versions with explicit evidence, effective dates and a review deadline. Publication records the authenticated actor. Shared synthetic presets remain read-only. Tenant-reviewed status is limited to that tenant and is never promoted to public VERIFIED status.

The initial rule subset is deterministic presence checks for supported canonical reference fields. The initial UI supports the already-implemented XRechnung UBL/download route. No tax cases, sending behavior or legal/recipient-acceptance claims are added. Unknown/unverified coverage remains visible in download workflows. Explicitly selected stale, mismatched or inapplicable profiles block approval/generation.

Approval/generation check the latest version and live applicability. A worker rechecks within its result transaction; publication is serialized against these checks. Historical validation/evidence records retain the complete profile snapshot and hash. Current list coverage can change with expiry without altering history. Revalidation of an approved revision against changed requirements supersedes its actionable approval state while preserving the earlier record.

This implements the documented profile scope without choosing a production identity provider, inventing real recipient instructions or asserting controlled-pilot acceptance. The remaining gates stay in TBD.md.
