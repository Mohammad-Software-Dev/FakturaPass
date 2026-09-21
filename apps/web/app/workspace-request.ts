"use client";
// Read the server-rendered tab context, never a shared cookie or localStorage selection.
export function workspaceFetch(input: string, init?: RequestInit) {
  const workspace = document
    .querySelector("[data-workspace-id]")
    ?.getAttribute("data-workspace-id");
  const headers = new Headers(init?.headers);
  if (workspace) headers.set("X-Workspace-Id", workspace);
  return fetch(input, { ...init, headers });
}
export function workspaceHref(path: string, workspace?: string) {
  return workspace
    ? `${path}${path.includes("?") ? "&" : "?"}workspace=${encodeURIComponent(workspace)}`
    : path;
}
