import de from "./de.json";
import en from "./en.json";
import type { Finding } from "../contracts/types";
export const locales = {
  de: { label: "Deutsch", intl: "de-DE" },
  en: { label: "English", intl: "en-GB" },
} as const;
export type Locale = keyof typeof locales;
export type MessageKey = keyof typeof de;
export const dictionaries = { de, en } satisfies Record<
  Locale,
  Record<MessageKey, string>
>;
export const localeCookie = "fakturapass-language";
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(locales, value);
}
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : "de";
}
export function negotiateLocale(header: string | null): Locale {
  const preferences = (header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().toLowerCase().split(";");
      const quality = parameters.find((p) => p.trim().startsWith("q="));
      return {
        tag: tag.split("-")[0],
        q: quality ? Number(quality.trim().slice(2)) : 1,
        index,
      };
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return (
    (preferences.find(({ tag }) => isLocale(tag))?.tag as Locale | undefined) ??
    "de"
  );
}
export function translate(
  locale: Locale,
  key: string,
  values: Record<string, string | number> = {},
): string {
  const catalog: Record<string, string> = dictionaries[locale];
  const template = Object.hasOwn(catalog, key) ? catalog[key] : key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
// Decimal strings are never converted to floating-point numbers, even for display.
export function decimal(
  locale: Locale,
  value: string,
  minimumFractionDigits = 0,
): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");
  const formatter = new Intl.NumberFormat(locales[locale].intl);
  const separator = new Intl.NumberFormat(locales[locale].intl)
    .formatToParts(1.1)
    .find((p) => p.type === "decimal")!.value;
  const digits = fraction.padEnd(minimumFractionDigits, "0");
  return `${negative ? "-" : ""}${formatter.format(BigInt(integer))}${digits ? separator + digits : ""}`;
}
export function money(locale: Locale, value: string): string {
  const amount = decimal(locale, value, 2).replace(/^-/, "");
  const parts = new Intl.NumberFormat(locales[locale].intl, {
    style: "currency",
    currency: "EUR",
  }).formatToParts(value.startsWith("-") ? -1 : 1);
  const first = parts.findIndex((p) => p.type === "integer");
  const last =
    parts.length -
    1 -
    [...parts]
      .reverse()
      .findIndex((p) =>
        ["integer", "group", "decimal", "fraction"].includes(p.type),
      );
  return (
    parts
      .slice(0, first)
      .map((p) => p.value)
      .join("") +
    amount +
    parts
      .slice(last + 1)
      .map((p) => p.value)
      .join("")
  );
}
export function date(locale: Locale, value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(locales[locale].intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  }).format(new Date(value));
}
export const apiErrorKeys: Record<string, MessageKey> = {
  SCHEMA_INVALID:
    "Die Datei entspricht nicht dem Rechnungsformat. Bitte prüfen Sie die markierten Felder.",
  INVALID_REQUEST: "Die Eingabe ist ungültig.",
  IDEMPOTENCY_CONFLICT:
    "Dieser Importschlüssel wurde bereits für andere Daten verwendet.",
  SOURCE_DUPLICATE:
    "Diese Quelle wurde bereits importiert. Öffnen Sie die Rechnung und erstellen Sie eine Korrektur.",
  RESOURCE_NOT_FOUND: "Der Eintrag ist nicht verfügbar.",
  APPROVAL_BLOCKED: "Die Rechnung kann noch nicht freigegeben werden.",
  APPROVAL_STALE:
    "Die Freigabe bezieht sich nicht auf den aktuellen Prüfstand.",
  REVISION_CONFLICT:
    "Die Revision oder ihr Status hat sich geändert. Bitte neu laden.",
  AUTH_REQUIRED: "Eine lokale Identität ist erforderlich.",
  LAST_ADMIN_REQUIRED:
    "Mindestens eine aktive Administration muss erhalten bleiben.",
  ACCESS_DENIED: "Diese Aktion ist für Ihre Rolle nicht erlaubt.",
  ARTIFACT_HASH_MISMATCH: "Die Prüfsumme des Artefakts stimmt nicht überein.",
  RECIPIENT_PROFILE_UNKNOWN: "Empfängeranforderungen unbekannt",
  INTERNAL_ERROR: "Die Anfrage konnte nicht verarbeitet werden.",
};
export const findingTitles: Record<string, MessageKey> = {
  TOTAL_MISMATCH: "Rechnungsbeträge stimmen nicht überein",
  TAX_BREAKDOWN_MISMATCH: "Steueraufschlüsselung stimmt nicht überein",
  RECIPIENT_REQUIREMENT_MISSING: "Erforderliche Empfängerreferenz fehlt",
  RECIPIENT_PROFILE_UNKNOWN: "Empfängeranforderungen unbekannt",
  UNSUPPORTED_CASE: "Dieser Rechnungsfall wird nicht unterstützt",
  REQUIRED_FIELD_MISSING: "Erforderliche Angabe fehlt",
  VALIDATION_FAILED: "Hinweis aus der offiziellen XRechnung-Prüfung",
  ENGINE_UNAVAILABLE: "Prüfdienst vorübergehend nicht erreichbar",
  SCHEMA_INVALID: "Eingabeformat prüfen",
  INVALID_REQUEST: "Die Eingabe ist ungültig.",
  DECIMAL_INVALID: "Ungültiger Dezimalwert",
};
const ruleMessages: Record<string, MessageKey> = {
  "BR-DE-TMP-32":
    "Ein Liefer- oder Leistungsdatum bzw. Zeitraum sollte angegeben werden.",
  "BR-DE-2": "Die Kontaktdaten des Verkäufers sind erforderlich.",
  "BR-DE-5": "Der Name des Verkäuferkontakts ist erforderlich.",
  "BR-DE-6": "Die Telefonnummer des Verkäuferkontakts ist erforderlich.",
  "BR-DE-7": "Die E-Mail-Adresse des Verkäuferkontakts ist erforderlich.",
  "BR-DE-27": "Die Telefonnummer des Verkäuferkontakts muss gültig sein.",
  "BR-DE-15": "Eine Käuferreferenz ist erforderlich.",
};
export function findingDescription(locale: Locale, finding: Finding): string {
  const t = (key: string) => translate(locale, key);
  if (finding.layer === "STANDARD")
    return t(
      ruleMessages[finding.ruleId ?? ""] ??
        (/^BR-CO-(10|13|14|15|16)$/.test(finding.ruleId ?? "")
          ? "Die Beträge müssen den offiziellen Summenregeln entsprechen."
          : "Der offizielle Validator meldet einen Befund. Prüfen Sie die Regel und die Originaldiagnose in den technischen Details."),
    );
  if (finding.code === "SCHEMA_INVALID") {
    const keyword = String(finding.parameters.keyword);
    const keys: Record<string, MessageKey> = {
      required: "Erforderliches Feld fehlt.",
      additionalProperties: "Nicht erlaubtes Feld vorhanden.",
      type: "Der Datentyp ist ungültig.",
      pattern: "Der Wert entspricht nicht dem erwarteten Format.",
      format: "Der Wert entspricht nicht dem erwarteten Format.",
      const: "Der Wert ist nicht zulässig.",
      enum: "Der Wert ist nicht zulässig.",
      minLength: "Der Wert liegt außerhalb der erlaubten Grenzen.",
      maxLength: "Der Wert liegt außerhalb der erlaubten Grenzen.",
      minItems: "Die Liste entspricht nicht den Anforderungen.",
      maxItems: "Die Liste entspricht nicht den Anforderungen.",
    };
    return t(keys[keyword] ?? "Bitte prüfen Sie die betroffene Angabe.");
  }
  if (
    typeof finding.parameters.reason === "string" &&
    Object.hasOwn(de, finding.parameters.reason)
  )
    return t(finding.parameters.reason);
  if (
    finding.code === "RECIPIENT_PROFILE_UNKNOWN" &&
    finding.parameters.coverage &&
    finding.parameters.coverage !== "UNKNOWN"
  )
    return t(
      "Das Empfängerprofil ist nicht aktuell oder passt nicht zu dieser Rechnung. Prüfen Sie die Anforderungen und wählen Sie eine gültige Version.",
    );
  if (finding.code === "RECIPIENT_PROFILE_UNKNOWN")
    return t(
      "Für diesen Empfänger liegen keine verifizierten Anforderungen vor.",
    );
  if (finding.code === "RECIPIENT_REQUIREMENT_MISSING")
    return t(
      "Für das gewählte Empfängerprofil ist diese Angabe erforderlich. Prüfen Sie den hinterlegten Nachweis.",
    );
  if (finding.code === "TOTAL_MISMATCH")
    return t(
      "Vergleichen Sie den angegebenen Betrag mit dem berechneten Wert und korrigieren Sie die Quelldaten.",
    );
  if (finding.code === "TAX_BREAKDOWN_MISMATCH")
    return t(
      "Prüfen Sie die Steuergruppen und die zugehörigen Nettobeträge und Steuerbeträge.",
    );
  return t("Bitte prüfen Sie die betroffene Angabe.");
}
