import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  oidcEnabled,
  sessionWorkspaces,
} from "../../../packages/identity/oidc";
import Workspace from "./workspace";
import brandProject from "../../../examples/customer-invoice-brand-project.json";
import consulting from "../../../examples/customer-invoice-consulting.json";
import equipment from "../../../examples/customer-invoice-office-equipment.json";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  let workspace: { id: string; name: string } | undefined;
  if (oidcEnabled()) {
    let available;
    try {
      available = await sessionWorkspaces((await headers()).get("cookie"));
    } catch {}
    if (!available) redirect("/sign-in");
    const requested = (await searchParams).workspace;
    workspace = requested
      ? available.items.find((item) => item.id === requested)
      : available.items.length === 1
        ? available.items[0]
        : undefined;
    if (!workspace) redirect("/workspaces");
  }
  return (
    <Workspace
      signedIn={oidcEnabled()}
      workspaceId={workspace?.id}
      workspaceName={workspace?.name}
      fixtures={[
        {
          name: "Beratungsleistung · 19 % USt.",
          code: "consulting",
          data: consulting,
        },
        {
          name: "Büroausstattung · Projektrabatt",
          code: "office-equipment",
          data: equipment,
        },
        {
          name: "Markenprojekt · Anzahlung",
          code: "brand-project",
          data: brandProject,
        },
      ]}
    />
  );
}
