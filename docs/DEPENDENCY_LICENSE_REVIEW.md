# Installed dependency license review

Status reviewed 12 October 2026: both installed npm license gates passed in the completed 4 October image run. The last bundled tar finding was resolved by removing the whole unused compiler downloader and archive bundle from production images. No license allowlist expansion, fabricated version or security exception was used. This is engineering gate acceptance, not legal approval of distribution.

## Accepted application packaging

Evidence: `.data/releases/504cf8821ebb3a5d1cd4f02bbd4e4fb487540800-1791125467452/`. Its final manifest records passing web/worker vulnerability and license gates, container acceptance and npm audit. All manifest evidence hashes were rechecked on 12 October. The vulnerability database is dated 4 October and is historical evidence; refresh scans before promotion under the unchanged 120-hour freshness policy.

The build-stage Next.js installation retains tar. Production packaging removes `dist/compiled/tar` and the unused SWC downloader files together. The script requires the reviewed Next.js 16.3.6 version and rejects unexpected literal bundle consumers; framework upgrades require packaging review. Container acceptance asserts that both downloader and bundle are absent and tests the actual compiled server. Runtime compilation/downloads are not part of the deployment contract.

OS/native notice review, separate validator acceptance and other production gates remain open. The historical findings below apply to older images and must not be treated as approval to distribute those older bundles.

## Previous standalone packaging

The web image now uses Next.js 16.3.6 standalone output; worker/operator dependencies are traced separately and the worker no longer ships Next.js. The installed inventories no longer include `@vercel/og`, `babel-packages` or `constants-browserify`. The only remaining npm license finding is compiled `tar`: BlueOak-1.0.0, version UNKNOWN. Its LICENSE is retained.

Previous evidence: `.data/releases/ccc79d24a1558320e7019500509da1d18e2a3c64-1791124929352/`. The `license-review-evidence.json` packet records the immutable web image, declarations, license text, missing NOTICE record and executable bundle hash. Native installed inventories and license reports cover both images.

The pinned [Next.js source declaration](https://github.com/vercel/next.js/blob/v16.3.6/packages/next/package.json) names tar 7.5.11; its [bundle task](https://github.com/vercel/next.js/blob/v16.3.6/packages/next/taskfile.js) compiles tar into this location. This suggests provenance but does not prove the installed compiled bundle version. The local framework references it from the SWC downloader. Version UNKNOWN limits vulnerability matching: establish the actual bundled version and assess applicable advisories before promotion, as well as reviewing distribution obligations. A passing scanner result cannot close this gap. Do not simply allowlist the license or invent a version in package metadata.

Resolution for the new application images: remove the whole unused compiler downloader and tar bundle with guarded packaging and exact-image verification, as recorded above. The older bundle’s version was not established or relabeled.

## Previous full dependency installation

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
