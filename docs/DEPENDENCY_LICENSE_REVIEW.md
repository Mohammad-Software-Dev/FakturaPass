# Installed dependency license review

Status: four review requirements remain open. This is a concrete evidence packet, not legal approval. The release license gate remains blocked; no allowlist expansion or license exception has been added.

The affected packages are bundled inside Next.js 16.3.5. Evidence was read from the immutable web image built at `7056816e4451859faaafdc24e8aa4867706be3bb`; the same four findings occur in the shared worker dependency set. Installed package declarations, available LICENSE files, missing-file records and SHA-256 hashes are retained in `.data/releases/7056816e4451859faaafdc24e8aa4867706be3bb-1790515523014/license-review-evidence.json`.

| Bundled package        | Installed declaration         | Installed LICENSE | Required resolution                                                                                                                                                            |
| ---------------------- | ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@vercel/og` 0.11.1    | MPL-2.0                       | Present           | Review intended use/distribution and applicable notice/source obligations; record an authorized policy decision or remove the dependency through a supported packaging change. |
| `babel-packages`       | License and version absent    | Missing           | Trace the bundle to the pinned upstream Next.js source, establish its constituent versions/licenses, and supply the appropriate retained notices before claiming compliance.   |
| `constants-browserify` | License and version absent    | Missing           | Establish upstream provenance/version and applicable license, then retain the required notice. Do not infer permission from the enclosing package's license.                   |
| Bundled npm `tar`      | BlueOak-1.0.0; version absent | Present           | Establish bundled version/provenance and record an authorized license-policy decision for the intended distribution. This finding is not the operating-system tar utility.     |

All paths begin at `/app/node_modules/next/dist/compiled/`, followed by the package name. The packet includes `package.json`, `LICENSE` and `NOTICE` where present; an absent NOTICE is recorded as evidence, not automatically classified as a violation. A package-name match alone must not authorize or exclude another dependency.

A reviewer should record the exact image/package hashes, reviewed source, intended deployment/distribution model, required notices or source access, accountable owner and decision reference. Engineering then implements the bounded decision and reruns both installed-package license gates. A future dependency upgrade must be reviewed against its own evidence. Publishing a source issue, contacting maintainers or obtaining external legal review requires the owner's chosen route; none has been initiated here.

Provider-independent engineering can continue with validator-image acceptance and supported packaging improvements while these decisions are pending. Production promotion remains blocked.
