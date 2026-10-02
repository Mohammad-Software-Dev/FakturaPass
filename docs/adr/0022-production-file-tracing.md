# ADR 0022: Trace production application dependencies

Date: 2026-10-02
Status: implemented; production promotion remains gated

## Decision

Use Next.js standalone output for web, and the file tracer bundled in the pinned Next.js version for external dependencies of bundled worker/operator entry points. The worker does not install Next.js. Copy static web assets separately. Keep explicit operator commands, migrations and the non-root/read-only runtime contract.

The packaging script fails on unexpected unresolved imports, missing source provenance for traced package declarations, and native Node add-ons crossing the Debian-to-musl boundary. Only pg’s optional native and Cloudflare adapters are exempt from trace-warning failure. Generated Next.js CommonJS code uses a minimal root CommonJS package declaration; operator bundles remain explicit ESM files. Copy only those bundles into the runtime directory to avoid duplicate first-party declarations.

When image optimization is explicitly disabled, remove whole unused Sharp and `@img/sharp-*` packages traced conservatively by Next.js. Preserve portable colour helpers. Copy available LICENSE, COPYING and NOTICE files from each traced package’s installed source; do not remove metadata to alter scan results. Re-enabling optimization requires revisiting this packaging contract.

## Evidence and limits

Installed filesystem Syft inventories and exact-image acceptance remain authoritative. The retained npm dependency-graph SBOM describes the broader declared production graph and is comparative evidence, not an assertion that every listed dependency is shipped. Tracing can retain conditional build-time paths, including a compiled tar package with an absent version. A passing vulnerability matcher does not resolve an unidentified bundled version; provenance/license review still blocks promotion.

Full application tests and container acceptance cover the shipped server, worker, migrations, official validation, imports, editing, previews, exports, locales and themes. Local ARM64 evidence does not establish other architecture support. See RELEASE_A_RESULTS.md for exact results and DEPENDENCY_LICENSE_REVIEW.md for outstanding review.
