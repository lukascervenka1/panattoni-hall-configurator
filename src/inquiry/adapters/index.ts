import { createDynamics365Adapter } from "./dynamics365";
import { createMockAdapter } from "./mock";
import type { InquiryAdapter } from "./types";

export type { InquiryAdapter, SubmitResult } from "./types";

/** Adaptér, který nic neodešle a vždy hlásí důvod; použije se, když je ostrý adaptér vybrán, ale není nastaven nebo schválen. */
function blockedAdapter(name: string, reason: string): InquiryAdapter {
  return { name, mock: false, submit: async () => ({ status: "failed", retryable: false, reason }) };
}

type Env = Record<string, string | undefined>;

/**
 * Vybere adaptér podle prostředí (`INQUIRY_ADAPTER`: mock | dynamics365, výchozí mock).
 *
 * Ostrý adaptér se nikdy nespustí "tiše": chybí-li nastavení, nebo není-li výslovně schváleno skutečné odesílání
 * (`INQUIRY_REAL_SEND_APPROVED=yes`, spec kap. 1 a 13), poptávka se odmítne s kódem chyby a nic se neodešle ani
 * nenahradí mockem, který by tvrdil opak.
 */
export function createInquiryAdapter(env: Env = process.env): InquiryAdapter {
  const kind = (env.INQUIRY_ADAPTER ?? "mock").trim().toLowerCase();
  if (kind === "mock") return createMockAdapter();
  if (kind === "dynamics365") {
    if (env.INQUIRY_REAL_SEND_APPROVED !== "yes") return blockedAdapter("dynamics365", "real_send_not_approved");
    const { DYNAMICS_ORG_URL: orgUrl, DYNAMICS_TENANT_ID: tenantId, DYNAMICS_CLIENT_ID: clientId, DYNAMICS_CLIENT_SECRET: clientSecret } = env;
    if (!orgUrl || !tenantId || !clientId || !clientSecret) return blockedAdapter("dynamics365", "adapter_not_configured");
    return createDynamics365Adapter({
      orgUrl,
      tenantId,
      clientId,
      clientSecret,
      fields: { configJson: env.DYNAMICS_FIELD_CONFIG_JSON, submissionId: env.DYNAMICS_FIELD_SUBMISSION_ID, intent: env.DYNAMICS_FIELD_INTENT },
    });
  }
  return blockedAdapter(kind, "unknown_adapter");
}
