# Validator source and notice evidence

Run `npm run validator:source-evidence -- sha256:<immutable-image-id>` with Python 3, curl, Docker and access to the pinned upstream sources. This independent review command does not build, publish or deploy an image. It writes a packet under `.data/releases/validator-sources-<timestamp>/` and writes `source-evidence.json` only after all checks pass. Partial directories are not completed packets. The report records its source revision and whether the checkout was dirty.

The lock at `services/invoice-engine/metadata/sources.lock.json` pins the current Linux ARM64 JRE archive hash, exact JDK source commit, 31 individual source hashes, and the Saxon 12.9 source/distribution archive hashes. Another architecture or dependency update requires its own verified lock evidence; this command does not silently accept another binary. Downloads require HTTPS and immutable Git commit URLs. No upstream program is executed and archive entries are not extracted into arbitrary filesystem paths.

The collector reads the exact image's JRE build metadata and requires the expected version, repository and source reference. It verifies jrt-fs bytes, maps every installed class (including inner classes) to exactly one source file and rejects missing, extra or ambiguous source records. Each source is hash-checked and must retain the expected GPL version 2 only and Classpath exception header. The original JRE LICENSE, ADDITIONAL_LICENSE_INFO and ASSEMBLY_EXCEPTION are included. This establishes source/header correspondence; it does not claim a reproduced JRE build or complete source distribution for the entire runtime.

For Saxon, the installed Maven JAR hash is pinned. The collector retains the matching upstream source ZIP and binary distribution with all its notices. Every member payload of the distribution JAR is compared with the installed JAR. Only the manifest and two named signature files may differ; changed class or resource bytes fail. Original notices remain intact, including notices for upstream distribution components not installed by FakturaPass. Their presence is not a statement that every upstream component is shipped.

## Verified result — 12 October 2026

For image `sha256:e5bd737a6abe2f8270d42ef4d0647467c96e232301ef5a0edbb36210c8328728`, the packet at `.data/releases/validator-sources-1791835217465/` verifies 57 jrt-fs classes against 31 source files at JDK commit `520406d871955300957ef01e406ac2acd0f9b75c`. All 31 files have the explicit exception header. Saxon's 2,600 class files and other payloads match; only `META-INF/MANIFEST.MF`, `META-INF/SAXON.RSA` and `META-INF/SAXON.SF` differ. The packet records both JAR hashes. All retained file hashes were rechecked after collection.

Three focused tests cover tampered evidence, exact source coverage and rejection of changed Saxon classes/resources. They run in the validator CI job. The collector was exercised end to end against the immutable local image. It does not affect runtime behavior, so the earlier container/browser acceptance remains applicable; those tests were not repeated.

## Remaining review and release sequence

The installed archive's missing scanner declaration is now supported by exact-source header evidence, but the permissive-only policy still blocks it. Saxon's MPL-2.0 remains outside that policy too. No allowlist expansion, legal approval or exception has been recorded.

[Saxonica distinguishes its preferred-form source repository from the preprocessed release ZIP](https://www.saxonica.com/html/documentation12/conditions/index.html). The packet retains the latter; it must not be presented as completing preferred-form source availability. Review that source form and the intended distribution model, complete XML Resolver/W3C resource and invoice-configuration notices, and record the applicable license/notice decision before changing a gate. See [the upstream Adoptium FAQ](https://adoptium.net/docs/faq) for the general runtime licensing declaration; the retained exact-source headers provide the package-specific evidence.

After those reviews, rebuild matching web, worker and validator images and repeat combined security and functional acceptance. Registry signing, staging/rollback and production acceptance remain separate. This source packet is neither a release manifest nor a legal clearance.
