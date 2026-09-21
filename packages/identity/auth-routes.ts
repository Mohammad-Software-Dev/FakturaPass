import { invitationPreview } from "./invitations";
import { ApiError } from "../domain/service";
import {
  authCookie,
  beginLogin,
  finishLogin,
  logout,
  oidcEnabled,
  requireOrigin,
  settings,
  sessionWorkspaces,
} from "./oidc";
export async function authRoute(request: Request, action: string) {
  if (!oidcEnabled()) throw new ApiError("RESOURCE_NOT_FOUND", 404);
  const s = settings();
  const redirect = (path: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: new URL(path, s.origin).href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  if (action === "workspaces" && request.method === "GET")
    return Response.json(
      await sessionWorkspaces(request.headers.get("cookie")),
      { headers: { "Cache-Control": "no-store" } },
    );
  if (
    (action === "invitation" || action === "join") &&
    request.method === "POST"
  ) {
    requireOrigin(request);
    const expected =
      action === "invitation"
        ? "application/json"
        : "application/x-www-form-urlencoded";
    if (!request.headers.get("content-type")?.startsWith(expected))
      throw new ApiError("INVALID_REQUEST");
    const reader = request.body?.getReader();
    if (!reader) throw new ApiError("INVALID_REQUEST");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) {
        await reader.cancel();
        throw new ApiError("INVALID_REQUEST", 413);
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (action === "invitation") {
      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        throw new ApiError("INVALID_REQUEST");
      }
      return Response.json(await invitationPreview(input?.token, s.authority), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const token = new URLSearchParams(raw).get("token");
    try {
      if (!token) throw Error();
      const started = await beginLogin(token);
      const response = redirect(started.url);
      response.headers.append("Set-Cookie", started.cookie);
      return response;
    } catch {
      return redirect("/join?error=invalid");
    }
  }
  if (action === "login" && request.method === "POST") {
    requireOrigin(request);
    try {
      const started = await beginLogin();
      const response = redirect(started.url);
      response.headers.append("Set-Cookie", started.cookie);
      return response;
    } catch {
      return redirect("/sign-in?error=failed");
    }
  }
  if (action === "callback" && request.method === "GET") {
    let response: Response;
    try {
      const cookie = await finishLogin(request);
      const count = (await sessionWorkspaces(cookie)).items.length;
      response = redirect(
        count === 0 ? "/support" : count > 1 ? "/workspaces" : "/",
      );
      response.headers.append("Set-Cookie", cookie);
    } catch (error) {
      response = redirect(
        `/sign-in?error=${
          error instanceof ApiError && error.code === "INVITATION_INVALID"
            ? "invitation"
            : error instanceof ApiError && error.code === "ACCESS_DENIED"
              ? "access"
              : "failed"
        }`,
      );
    }
    response.headers.append("Set-Cookie", authCookie("login", "", 0));
    return response;
  }
  if (action === "logout" && request.method === "POST") {
    const cookie = await logout(request);
    const response = redirect("/sign-in?loggedOut=1");
    response.headers.append("Set-Cookie", cookie);
    response.headers.append("Set-Cookie", authCookie("login", "", 0));
    return response;
  }
  throw new ApiError("RESOURCE_NOT_FOUND", 404);
}
