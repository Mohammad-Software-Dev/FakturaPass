FROM node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY examples ./examples
COPY services/invoice-engine/dependencies.lock.json ./services/invoice-engine/dependencies.lock.json
COPY scripts ./scripts
RUN node scripts/build-runtime.mjs && npm run build

FROM dependencies AS production-dependencies
RUN npm sbom --sbom-format=cyclonedx --omit=dev > /tmp/npm-sbom.cdx.json && npm prune --omit=dev --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production AUTH_MODE=oidc FAKTURAPASS_ENV=PRODUCTION
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY --from=production-dependencies /tmp/npm-sbom.cdx.json ./release/npm-sbom.cdx.json
COPY --from=build /app/.data/runtime ./runtime
COPY packages/database/migrations ./packages/database/migrations
COPY infra/app/entrypoint.mjs ./entrypoint.mjs
ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/Mohammad-Software-Dev/FakturaPass" org.opencontainers.image.revision=$SOURCE_REVISION
USER 10001:10001
ENTRYPOINT ["node", "entrypoint.mjs"]

FROM runtime AS worker
CMD ["worker"]

FROM runtime AS web
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY apps/web/next.config.mjs ./apps/web/next.config.mjs
EXPOSE 3010
CMD ["web"]
