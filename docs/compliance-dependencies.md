# Compliance dependencies

Verified against official KoSIT GitHub releases on 12 September 2026. The machine-readable authority is `services/invoice-engine/dependencies.lock.json`. Downloaded bytes must match the listed SHA-256 hashes; setup fails on mismatch.

| Component               | Version            | Official release                                                                          |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| KoSIT Validator         | 1.6.3              | https://github.com/itplr-kosit/validator/releases/tag/v1.6.3                              |
| XRechnung configuration | 3.0.2 / 2026-01-31 | https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-01-31 |
| Container JVM           | Temurin 25.0.4+7   | Official Docker image, immutable digest in Dockerfile                                     |
| PostgreSQL              | 17.9 Alpine        | Official Docker image, immutable digest in Compose                                        |

The validator is Apache-2.0, verified from the v1.6.3 upstream LICENSE. The configuration repository is Apache-2.0; bundled UBL, CEN and other resources retain their own upstream licensing notices. Source links and third-party notices are in the downloaded bundle documentation. No binary is committed to this source repository.

The rule manifest records artifact names, URLs, release tags, hashes, license notes, retrieval date, support notes and review date. Rule updates are intentional changes: download and verify new artifacts, compare the complete fixture corpus, record an ADR, and retain historical manifests/evidence. Nothing floats to latest during startup.

The adapter checks the engine version, exact expected UBL scenario, official report's SHA-256 of the submitted bytes, and normalized VARL findings. Only a real successful official response can create ARTIFACT_VALIDATED. Recipient requirements remain a separate layer.

To run the pinned container JVM instead of your installed Java runtime:

```sh
npm run engine:setup
docker compose -f infra/compose.yaml --profile container-engine up -d --build invoice-engine
npm run dev
```

The launcher reuses a healthy engine already listening on 8089. The container runs as an unprivileged user, read-only, with no added capabilities and on a dedicated bridge network. Only its loopback port is published. For a separate smoke-test instance use `ENGINE_PORT=8090` with Compose.

On the tested Docker Desktop host the validator needed approximately three minutes to load all pinned scenarios. Wait for `Daemon started` in the engine logs before testing its HTTP endpoint. An internal-only Docker network prevented the published host port from working, so the engine uses a dedicated bridge and a loopback-only published port. The read-only container may emit a harmless Jansi terminal-color native-library warning; official validation still runs successfully.
