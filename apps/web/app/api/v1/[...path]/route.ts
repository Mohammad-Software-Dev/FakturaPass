import * as review from "../../../../../../packages/review/service";
import * as csvImport from "../../../../../../packages/mappings/service";
import {
  apiErrorKeys,
  negotiateLocale,
  translate,
} from "../../../../../../packages/i18n";
import { randomUUID, timingSafeEqual } from "node:crypto";
import * as service from "../../../../../../packages/domain/service";
import { pool } from "../../../../../../packages/database";
import * as recipients from "../../../../../../packages/recipients/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX = 1024 * 1024;
function identity(req: Request, requestId: string): service.Context {
  if (process.env.FAKTURAPASS_ENV !== "LOCAL")
    throw new service.ApiError("AUTH_REQUIRED", 401);
  const authorization = req.headers.get("authorization");
  if (authorization) {
    const token = authorization.replace(/^Bearer /, "");
    const identities: Record<
      string,
      { tenantId: string; actor: string; role: service.Context["role"] }
    > = JSON.parse(process.env.LOCAL_API_IDENTITIES ?? "{}");
    for (const [key, value] of Object.entries(identities)) {
      const a = Buffer.from(key),
        b = Buffer.from(token);
      if (a.length === b.length && timingSafeEqual(a, b))
        return { ...value, environment: "LOCAL", requestId };
    }
    throw new service.ApiError("AUTH_REQUIRED", 401);
  }
  // Dev browser identity is explicitly enabled, fixed server-side, and only on a loopback-bound server.
  if (process.env.LOCAL_BROWSER_IDENTITY !== "enabled")
    throw new service.ApiError("AUTH_REQUIRED", 401);
  const authority = req.headers.get("host") ?? new URL(req.url).host;
  if (!/^(localhost|127\.0\.0\.1)(:[0-9]{1,5})?$/.test(authority))
    throw new service.ApiError("AUTH_REQUIRED", 401);
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin !== `http://${authority}`)
      throw new service.ApiError("ACCESS_DENIED", 403);
  }
  return {
    tenantId: "local-demo",
    actor: "local-operator",
    role: "ADMIN",
    environment: "LOCAL",
    requestId,
  };
}
async function body(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new service.ApiError("INVALID_REQUEST", 400);
  if (Number(req.headers.get("content-length") ?? 0) > MAX)
    throw new service.ApiError("INVALID_REQUEST", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new service.ApiError("INVALID_REQUEST");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > MAX) {
      await reader.cancel();
      throw new service.ApiError("INVALID_REQUEST", 413);
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  try {
    return {
      json: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
      raw,
    };
  } catch {
    throw new service.ApiError("INVALID_REQUEST", 400, {
      reason: "Ungültiges JSON",
    });
  }
}
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const locale = negotiateLocale(req.headers.get("accept-language"));
  const incoming = req.headers.get("x-request-id");
  const requestId =
    incoming && /^[\w-]{1,100}$/.test(incoming) ? incoming : randomUUID();
  const headers = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const send = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  try {
    const { path: p } = await params;
    const method = req.method;
    const url = new URL(req.url);
    if (p.join("/") === "health/live" && method === "GET")
      return send({ status: "ok" });
    if (p.join("/") === "health/ready" && method === "GET") {
      try {
        await pool.query("SELECT 1");
        const engine = await fetch(
          `${process.env.INVOICE_ENGINE_URL ?? "http://127.0.0.1:8089"}/server/health`,
          { signal: AbortSignal.timeout(3000) },
        );
        if (!engine.ok) throw Error();
        return send({ status: "ready" });
      } catch {
        return send({ status: "not_ready" }, 503);
      }
    }
    const ctx = identity(req, requestId);
    if (p.join("/") === "review-queue" && method === "GET")
      return send(
        await review.list(ctx, {
          owner: url.searchParams.get("owner") ?? undefined,
          reason: url.searchParams.get("reason") ?? undefined,
          limit: url.searchParams.has("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined,
          cursor: url.searchParams.get("cursor") ?? undefined,
        }),
      );
    if (
      p[0] === "review-queue" &&
      p.length === 3 &&
      p[2] === "assignment" &&
      method === "POST"
    )
      return send(await review.assign(ctx, p[1], (await body(req)).json));

    if (p.join("/") === "mapping-recipes" && method === "GET")
      return send({ items: await csvImport.recipes(ctx) });
    if (p.join("/") === "csv/preview" && method === "POST")
      return send(await csvImport.preview(ctx, (await body(req)).json));
    if (p.join("/") === "csv/import" && method === "POST")
      return send(
        await csvImport.commit(
          ctx,
          (await body(req)).json,
          req.headers.get("idempotency-key") ?? "",
        ),
      );

    if (p[0] === "invoices" && p.length === 1) {
      if (method === "GET") {
        const limit = Number(url.searchParams.get("limit") ?? 50);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
          throw new service.ApiError("INVALID_REQUEST");
        return send(
          await service.list(
            ctx,
            url.searchParams.get("status"),
            limit,
            url.searchParams.get("cursor"),
          ),
        );
      }
      if (method === "POST") {
        const { json, raw } = await body(req);
        return send(
          await service.ingest(
            ctx,
            json,
            raw,
            req.headers.get("idempotency-key") ?? "",
          ),
          201,
        );
      }
    }
    if (p[0] === "invoices" && p.length === 2 && method === "GET")
      return send(await service.detail(ctx, p[1]));
    if (
      p[0] === "invoices" &&
      p[2] === "evidence" &&
      p.length === 3 &&
      method === "GET"
    )
      return new Response(
        JSON.stringify(
          await service.evidence(ctx, p[1], url.searchParams.get("revisionId")),
          null,
          2,
        ),
        {
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Content-Disposition":
              'attachment; filename="fakturapass-evidence.json"',
          },
        },
      );
    if (p[0] === "invoices" && p[2] === "revisions") {
      if (p.length === 3 && method === "POST") {
        const { json, raw } = await body(req);
        if (
          !json ||
          typeof json.priorRevisionId !== "string" ||
          !json.canonical ||
          Object.keys(json).some(
            (k) => !["priorRevisionId", "canonical"].includes(k),
          )
        )
          throw new service.ApiError("INVALID_REQUEST");
        return send(
          await service.correct(
            ctx,
            p[1],
            json.priorRevisionId,
            json.canonical,
            raw,
          ),
          201,
        );
      }
      if (p.length === 4 && method === "GET")
        return send(await service.revisionDetail(ctx, p[1], p[3]));
      if (p.length === 5 && method === "POST") {
        const { json } = await body(req);
        const allowed: Record<string, string[]> = {
          validate: ["recipientProfileVersionId"],
          approve: ["validationRunId", "recipientProfileVersionId"],
          generate: [],
        };
        if (
          !json ||
          typeof json !== "object" ||
          Array.isArray(json) ||
          !allowed[p[4]] ||
          Object.keys(json).some((k) => !allowed[p[4]].includes(k)) ||
          (json.recipientProfileVersionId != null &&
            typeof json.recipientProfileVersionId !== "string") ||
          (p[4] === "approve" && typeof json.validationRunId !== "string")
        )
          throw new service.ApiError("INVALID_REQUEST");
        if (p[4] === "validate")
          return send(
            await service.enqueueValidation(
              ctx,
              p[1],
              p[3],
              json.recipientProfileVersionId ?? null,
            ),
            202,
          );
        if (p[4] === "approve")
          return send(
            await service.approve(
              ctx,
              p[1],
              p[3],
              json.validationRunId,
              json.recipientProfileVersionId ?? null,
            ),
            201,
          );
        if (p[4] === "generate")
          return send(await service.enqueueGeneration(ctx, p[1], p[3]), 202);
      }
    }
    if (p[0] === "validation-runs" && p.length === 2 && method === "GET")
      return send(await service.getRun(ctx, p[1]));
    if (
      p[0] === "artifacts" &&
      method === "GET" &&
      (p.length === 2 || (p.length === 3 && p[2] === "download"))
    ) {
      const a = await service.artifact(ctx, p[1]);
      if (p[2] === "download")
        return new Response(new Uint8Array(a.bytes), {
          headers: {
            ...headers,
            "Content-Type": "application/xml",
            "Content-Disposition": `attachment; filename="xrechnung-${a.id}.xml"`,
          },
        });
      return send({
        artifactId: a.id,
        invoiceId: a.invoice_id,
        revisionId: a.revision_id,
        syntax: a.syntax,
        profile: a.profile,
        generatorVersion: a.generator_version,
        sha256: a.sha256,
        createdAt: a.created_at,
        validationStatus: a.validation_status,
      });
    }
    if (p[0] === "recipient-profiles") {
      const localize = (profile: any) => ({
        ...profile,
        displayName:
          profile.status === "SYNTHETIC"
            ? translate(locale, profile.displayName)
            : profile.displayName,
      });
      if (p.length === 1 && method === "GET")
        return send({ items: (await recipients.list(ctx)).map(localize) });
      if (p.length === 1 && method === "POST")
        return send(await recipients.publish(ctx, (await body(req)).json), 201);
      if (p.length === 3 && p[2] === "versions" && method === "GET")
        return send({
          items: (await recipients.history(ctx, p[1])).map(localize),
        });
      if (p.length === 2 && method === "GET")
        return send(
          localize(
            (await recipients.history(ctx, p[1])).find((x) => x.current),
          ),
        );
    }
    throw new service.ApiError("RESOURCE_NOT_FOUND", 404);
  } catch (error) {
    const e =
      error instanceof service.ApiError
        ? error
        : new service.ApiError("INTERNAL_ERROR", 500);
    if (e.status === 500)
      console.error(
        JSON.stringify({ service: "web", requestId, code: e.code }),
      );
    return Response.json(
      {
        error: {
          code: e.code,
          message: translate(
            locale,
            apiErrorKeys[e.code] ??
              "Die Anfrage konnte nicht verarbeitet werden.",
          ),
          requestId,
          details: e.details,
        },
      },
      {
        status: e.status,
        headers: {
          ...headers,
          "Content-Language": locale,
          Vary: "Accept-Language",
        },
      },
    );
  }
}
export { handler as GET, handler as POST };
