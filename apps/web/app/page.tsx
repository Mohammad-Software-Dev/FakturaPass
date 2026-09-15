import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { oidcEnabled, sessionContext } from "../../../packages/identity/oidc";
import Workspace from "./workspace";
import brandProject from "../../../examples/customer-invoice-brand-project.json";
import consulting from "../../../examples/customer-invoice-consulting.json";
import equipment from "../../../examples/customer-invoice-office-equipment.json";
export default async function Page() {
  if (oidcEnabled()) {
    let allowed = false;
    try {
      await sessionContext((await headers()).get("cookie"), "page");
      allowed = true;
    } catch {}
    if (!allowed) redirect("/sign-in");
  }
  return (
    <Workspace
      signedIn={oidcEnabled()}
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
