import { ApiError } from "../domain/service";
import {
  authCookie,
  beginLogin,
  finishLogin,
  logout,
  oidcEnabled,
  requireOrigin,
  settings,
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
      response = redirect("/");
      response.headers.append("Set-Cookie", cookie);
    } catch (error) {
      response = redirect(
        `/sign-in?error=${error instanceof ApiError && error.code === "ACCESS_DENIED" ? "access" : "failed"}`,
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
