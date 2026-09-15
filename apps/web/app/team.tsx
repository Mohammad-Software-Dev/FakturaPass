"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
import { apiErrorKeys } from "../../../packages/i18n";
type Member = {
  id: string;
  subject: string;
  role: string;
  status: string;
  version: number;
};
const roleNames: Record<string, string> = {
  ADMIN: "Administration",
  OPERATOR: "Sachbearbeitung",
  APPROVER: "Freigabe",
  READ_ONLY: "Nur lesen",
};
function MemberCard({
  member,
  actor,
  onSave,
  busy,
}: {
  member: Member;
  actor: string;
  onSave: (member: Member, role: string, status: string) => void;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const [role, setRole] = useState(member.role),
    [status, setStatus] = useState(member.status);
  return (
    <article className="review-item team-member">
      <h3>
        {member.subject}
        {member.subject === actor ? ` · ${t("Ihr Konto")}` : ""}
      </h3>
      <p>
        {t(roleNames[member.role])} ·{" "}
        {t(member.status === "ACTIVE" ? "Aktiv" : "Gesperrt")}
      </p>
      <div className="review-filters">
        <label>
          {t("Rolle")}
          <select
            aria-label={t("Rolle")}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
          >
            {Object.entries(roleNames).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Zugang")}
          <select
            aria-label={t("Zugang")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={busy}
          >
            <option value="ACTIVE">{t("Aktiv")}</option>
            <option value="SUSPENDED">{t("Gesperrt")}</option>
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || (role === member.role && status === member.status)}
          onClick={() => onSave(member, role, status)}
        >
          {t("Zugriff speichern")}
        </button>
      </div>
    </article>
  );
}
export function Team() {
  const { t } = useLanguage();
  const [data, setData] = useState<{ actor: string; items: Member[] } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(false),
    [busy, setBusy] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    fetch("/api/v1/memberships", { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error?.code || "INTERNAL_ERROR");
        if (!controller.signal.aborted) setData(body);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [refresh]);
  async function save(member: Member, role: string, status: string) {
    setBusy(true);
    setError("");
    setNotice(false);
    try {
      const response = await fetch(`/api/v1/memberships/${member.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, status, expectedVersion: member.version }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error?.code || "INTERNAL_ERROR");
      setNotice(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefresh((n) => n + 1);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t("TEAM")}</div>
        <h1>{t("Zugriff gemeinsam organisieren")}</h1>
        <p>
          {t("Verwalten Sie Rollen und Zugang für bestehende Teammitglieder.")}
        </p>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>{t("Teamzugriff")}</h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              setNotice(false);
              setRefresh((n) => n + 1);
            }}
          >
            {t("Aktualisieren")}
          </button>
        </div>
        <div className="panel-body">
          <p>
            {t(
              "Administration verwaltet das Team. Sachbearbeitung bereitet Rechnungen vor. Freigabe prüft und genehmigt. Nur lesen erlaubt Einsicht und Downloads.",
            )}
          </p>
          <p>
            {t(
              "Eine Sperre gilt ab der nächsten Anfrage. Mindestens eine aktive Administration bleibt erhalten.",
            )}
          </p>
          {error && (
            <p className="error-banner" role="alert">
              {t(
                apiErrorKeys[error] ||
                  "Die Anfrage konnte nicht verarbeitet werden.",
              )}
            </p>
          )}
          {notice && (
            <p role="status">{t("Der Teamzugriff wurde gespeichert.")}</p>
          )}
          {busy && <p role="status">{t("Team wird geladen …")}</p>}
          {data?.items.map((member) => (
            <MemberCard
              key={`${member.id}:${member.version}`}
              member={member}
              actor={data.actor}
              onSave={save}
              busy={busy}
            />
          ))}
        </div>
      </section>
    </>
  );
}
