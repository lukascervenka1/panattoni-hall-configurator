"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useConfigStore } from "@/configurator/state/config-store";
import { CONSENT_TEXT_VERSION, INQUIRY_INTENTS, INTENT_LABEL_CS, type InquiryIntent } from "@/inquiry/schema";

type Status = "idle" | "sending" | "done" | "error";
interface Done {
  reference: string;
  mock: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Poptávka podle konfigurace (spec kap. 13): jen potřebné údaje, souhlas a serverové ověření. Cenu klient neposílá;
 * server ji přepočítá. Dokud je zapnutý demo adaptér, rozhraní říká, že se nic neodeslalo.
 */
export function InquiryForm() {
  const config = useConfigStore((s) => s.config);
  const uid = useId();
  const submissionId = useRef<string>("");
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<InquiryIntent>("order");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const problems: Record<string, string> = {};
  if (company.trim().length < 1) problems.company = "Vyplňte firmu.";
  if (name.trim().length < 2) problems.name = "Vyplňte kontaktní osobu.";
  if (!EMAIL.test(email.trim())) problems.email = "Zadejte platný e-mail.";
  if (phone.trim() && !/^[+0-9 ()./-]{6,24}$/.test(phone.trim())) problems.phone = "Telefon zadejte jen číslicemi, např. +420 777 123 456.";
  if (!consent) problems.consent = "Pro odeslání je nutný souhlas.";
  const shown = (key: string) => (touched[key] ? problems[key] : undefined);
  const blur = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched({ company: true, name: true, email: true, phone: true, consent: true });
    if (Object.keys(problems).length > 0) return;
    if (!submissionId.current) submissionId.current = crypto.randomUUID();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionId: submissionId.current,
          intent,
          contact: { company: company.trim(), name: name.trim(), email: email.trim(), phone: phone.trim() },
          note: note.trim(),
          consent: { accepted: true, textVersion: CONSENT_TEXT_VERSION },
          config,
          website: trap,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; reference?: string; mock?: boolean; message_cs?: string };
      if (res.ok && body.status === "accepted") {
        setDone({ reference: body.reference ?? "", mock: body.mock !== false });
        setStatus("done");
        return;
      }
      setError(body.message_cs ?? "Poptávku se nepodařilo odeslat.");
      setStatus("error");
    } catch {
      setError("Spojení se serverem selhalo. Údaje nebyly odeslány, zkuste to prosím znovu.");
      setStatus("error");
    }
  }

  function reset() {
    submissionId.current = "";
    setDone(null);
    setStatus("idle");
    setNote("");
    setConsent(false);
    setTouched({});
  }

  if (!open) {
    return (
      <section className="inquiry" aria-labelledby={`${uid}-h`}>
        <h2 id={`${uid}-h`} className="text-[17px]">Poptávka</h2>
        <p className="field-hint m-0">Pošlete nám tuto konfiguraci. Ozve se vám člen týmu Panattoni; cena zůstává orientační a nezávazná.</p>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Poslat poptávku</button>
        </div>
      </section>
    );
  }

  if (status === "done" && done) {
    return (
      <section className="inquiry" aria-labelledby={`${uid}-h`}>
        <h2 id={`${uid}-h`} className="text-[17px]">Poptávka</h2>
        <div className="inquiry-done" role="status" data-testid="inquiry-done">
          {done.mock ? (
            <>
              <p className="m-0 font-semibold">Demo: poptávka nebyla nikam odeslána.</p>
              <p className="field-hint m-0 mt-1">Tok jsme jen vyzkoušeli. Referenční kód {done.reference} je pouze ukázkový; údaje se neuložily ani nepředaly obchodnímu týmu.</p>
            </>
          ) : (
            <>
              <p className="m-0 font-semibold">Poptávka byla odeslána.</p>
              <p className="field-hint m-0 mt-1">Reference: {done.reference}. Kontaktní osoba z týmu Panattoni se vám ozve na zadaný e-mail.</p>
            </>
          )}
        </div>
        <div>
          <button type="button" className="btn" onClick={reset}>Poslat další poptávku</button>
        </div>
      </section>
    );
  }

  return (
    <section className="inquiry" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="text-[17px]">Poptávka</h2>
      <p className="inquiry-note" role="note">Demo: dokud není připojeno CRM, se poptávka nikam neodešle a ceny nejsou schválené.</p>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <fieldset className="inquiry-intents">
          <legend className="field-label mb-2">Čím vám můžeme pomoci?</legend>
          {INQUIRY_INTENTS.map((v) => (
            <label key={v} className="inquiry-intent">
              <input type="radio" name={`${uid}-intent`} value={v} checked={intent === v} onChange={() => setIntent(v)} />
              <span>{INTENT_LABEL_CS[v]}</span>
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor={`${uid}-company`}>Firma</label>
          <input id={`${uid}-company`} className="text-input" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} onBlur={blur("company")} aria-invalid={Boolean(shown("company"))} aria-describedby={shown("company") ? `${uid}-company-e` : undefined} maxLength={120} required />
          {shown("company") && <p id={`${uid}-company-e`} className="inquiry-error">{shown("company")}</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${uid}-name`}>Kontaktní osoba</label>
          <input id={`${uid}-name`} className="text-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={blur("name")} aria-invalid={Boolean(shown("name"))} aria-describedby={shown("name") ? `${uid}-name-e` : undefined} maxLength={120} required />
          {shown("name") && <p id={`${uid}-name-e`} className="inquiry-error">{shown("name")}</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${uid}-email`}>E-mail</label>
          <input id={`${uid}-email`} type="email" className="text-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={blur("email")} aria-invalid={Boolean(shown("email"))} aria-describedby={shown("email") ? `${uid}-email-e` : undefined} maxLength={160} required />
          {shown("email") && <p id={`${uid}-email-e`} className="inquiry-error">{shown("email")}</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${uid}-phone`}>Telefon <span className="font-normal text-muted">(volitelné)</span></label>
          <input id={`${uid}-phone`} type="tel" className="text-input" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={blur("phone")} aria-invalid={Boolean(shown("phone"))} aria-describedby={shown("phone") ? `${uid}-phone-e` : undefined} maxLength={24} />
          {shown("phone") && <p id={`${uid}-phone-e`} className="inquiry-error">{shown("phone")}</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${uid}-note`}>Poznámka <span className="font-normal text-muted">(volitelné)</span></label>
          <textarea id={`${uid}-note`} className="text-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} />
        </div>

        {/* past na boty: skutečný uživatel pole nevidí */}
        <div className="hp-field" aria-hidden="true">
          <label>Web<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" /></label>
        </div>

        <div className="field">
          <label className="inquiry-intent" htmlFor={`${uid}-consent`}>
            <input id={`${uid}-consent`} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} onBlur={blur("consent")} aria-invalid={Boolean(shown("consent"))} aria-describedby={`${uid}-consent-t`} />
            <span id={`${uid}-consent-t`}>
              Souhlasím se zpracováním osobních údajů za účelem vyřízení této poptávky.
              <span className="field-hint block">Demo znění; závazné znění a odkaz na zásady zpracování schválí Panattoni.</span>
            </span>
          </label>
          {shown("consent") && <p className="inquiry-error">{shown("consent")}</p>}
        </div>

        {error && <p role="alert" className="inquiry-error text-[14px]">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary" disabled={status === "sending"}>{status === "sending" ? "Odesílám…" : "Odeslat poptávku"}</button>
          <button type="button" className="btn" onClick={() => setOpen(false)} disabled={status === "sending"}>Zavřít</button>
        </div>
        <p className="field-hint m-0">Odesíláme jen údaje z formuláře a vaši konfiguraci; cenu si server přepočítá sám.</p>
      </form>
    </section>
  );
}
