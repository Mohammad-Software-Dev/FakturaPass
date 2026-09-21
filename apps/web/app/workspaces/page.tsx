import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  oidcEnabled,
  sessionWorkspaces,
} from "../../../../packages/identity/oidc";
import { WorkspaceChoices } from "./workspace-choices";
export default async function Page() {
  if (!oidcEnabled()) redirect("/");
  let available;
  try {
    available = await sessionWorkspaces((await headers()).get("cookie"));
  } catch {}
  if (!available) redirect("/sign-in");
  return <WorkspaceChoices items={available.items} />;
}
