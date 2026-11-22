/**
 * Adaptér pro Microsoft Dynamics 365 (Dataverse Web API): vytvoří lead. Autentizace přes Microsoft Entra ID
 * (OAuth 2.0 client credentials, aplikační uživatel). NEOVĚŘENO proti skutečnému prostředí: používá jen standardní
 * entitu a pole; před ostrým provozem je nutné schválení (kap. 19) a zkouška v testovacím prostředí CRM.
 *
 * Chyby nesou jen kód (stavový kód HTTP); tělo odpovědi ani údaje z poptávky se do nich ani do logů nepřenášejí.
 */
import type { InquiryRecord } from "../record";
import { toDataverseLead, type LeadFieldNames } from "./crm-mapping";
import type { InquiryAdapter, SubmitResult } from "./types";

export interface Dynamics365Options {
  /** Adresa prostředí, např. https://org.crm4.dynamics.com (bez koncového lomítka). */
  orgUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  fields?: LeadFieldNames;
  apiVersion?: string;
  fetch?: typeof fetch;
  now?: () => number;
}

interface Token {
  value: string;
  expiresAt: number;
}

export function createDynamics365Adapter(options: Dynamics365Options): InquiryAdapter {
  const orgUrl = options.orgUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const version = options.apiVersion ?? "v9.2";
  let token: Token | null = null;

  async function getToken(): Promise<{ ok: true; value: string } | { ok: false; result: SubmitResult }> {
    if (token && token.expiresAt - 60_000 > now()) return { ok: true, value: token.value };
    let res: Response;
    try {
      res = await doFetch(`https://login.microsoftonline.com/${encodeURIComponent(options.tenantId)}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          scope: `${orgUrl}/.default`,
          grant_type: "client_credentials",
        }),
      });
    } catch {
      return { ok: false, result: { status: "failed", retryable: true, reason: "token_network" } };
    }
    if (!res.ok) return { ok: false, result: { status: "failed", retryable: res.status >= 500 || res.status === 429, reason: `token_http_${res.status}` } };
    const body = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!body || typeof body.access_token !== "string") return { ok: false, result: { status: "failed", retryable: false, reason: "token_invalid" } };
    token = { value: body.access_token, expiresAt: now() + (Number(body.expires_in) || 3600) * 1000 };
    return { ok: true, value: token.value };
  }

  return {
    name: "dynamics365",
    mock: false,
    async submit(record: InquiryRecord): Promise<SubmitResult> {
      const auth = await getToken();
      if (!auth.ok) return auth.result;
      let res: Response;
      try {
        res = await doFetch(`${orgUrl}/api/data/${version}/leads`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${auth.value}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
            "odata-version": "4.0",
            "odata-maxversion": "4.0",
          },
          body: JSON.stringify(toDataverseLead(record, options.fields)),
        });
      } catch {
        return { status: "failed", retryable: true, reason: "crm_network" };
      }
      if (res.status === 401) token = null; // token mohl vypršet nebo být odvolán; příští pokus si vyžádá nový
      if (!res.ok) return { status: "failed", retryable: res.status >= 500 || res.status === 429 || res.status === 401, reason: `crm_http_${res.status}` };
      // Dataverse vrací 204 a adresu vytvořeného záznamu v hlavičce OData-EntityId: …/leads(GUID)
      const entity = res.headers.get("odata-entityid") ?? "";
      const id = /\(([0-9a-fA-F-]{36})\)/.exec(entity)?.[1];
      return { status: "accepted", reference: id ?? record.id, mock: false };
    },
  };
}
