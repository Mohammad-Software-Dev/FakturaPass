export const credentialScopes = {
  "invoices:read": "Rechnungen und Nachweise lesen",
  "invoices:import": "Rechnungen importieren",
  "invoices:edit": "Rechnungen korrigieren",
  "invoices:validate": "Rechnungen validieren",
  "invoices:approve": "Rechnungen freigeben",
  "invoices:generate": "Rechnungsdateien erzeugen",
  "recipients:write": "Empfängerprofile veröffentlichen",
  "review:write": "Prüfaufgaben zuweisen",
} as const;
export type CredentialScope = keyof typeof credentialScopes;
// Explicit shapes keep new endpoints inaccessible until deliberately assigned a scope.
export function requiredCredentialScope(
  method: string,
  path: string,
): CredentialScope | undefined {
  if (
    method === "GET" &&
    /^(invoices(\/[^/]+(\/evidence|\/revisions\/[^/]+)?)?|validation-runs\/[^/]+|artifacts\/[^/]+(\/download)?|recipient-profiles(\/[^/]+(\/versions)?)?|mapping-recipes|review-queue)$/.test(
      path,
    )
  )
    return "invoices:read";
  if (method !== "POST") return undefined;
  if (/^(invoices|csv\/(preview|import))$/.test(path)) return "invoices:import";
  if (/^invoices\/[^/]+\/revisions$/.test(path)) return "invoices:edit";
  for (const action of ["validate", "approve", "generate"] as const)
    if (new RegExp(`^invoices/[^/]+/revisions/[^/]+/${action}$`).test(path))
      return `invoices:${action}`;
  if (path === "recipient-profiles") return "recipients:write";
  if (/^review-queue\/[^/]+\/assignment$/.test(path)) return "review:write";
}
