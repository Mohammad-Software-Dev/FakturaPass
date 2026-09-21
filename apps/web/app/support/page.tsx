import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  oidcEnabled,
  sessionIdentity,
} from "../../../../packages/identity/oidc";
import { SupportDesk } from "./support-desk";
export default async function Page() {
  if (!oidcEnabled()) redirect("/");
  try {
    await sessionIdentity((await headers()).get("cookie"));
  } catch {
    redirect("/sign-in");
  }
  return <SupportDesk />;
}
