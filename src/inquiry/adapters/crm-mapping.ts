/**
 * Převod záznamu poptávky na lead v Dynamics 365 (Dataverse Web API, entita `leads`).
 *
 * Používají se jen STANDARDNÍ pole entity lead: subject, firstname, lastname, companyname, emailaddress1, telephone1,
 * description. Vlastní (custom) pole organizace neznáme, proto se použijí jen tehdy, když jejich logické názvy
 * zadáte v prostředí (viz docs/INQUIRY.md); jinak všechno podstatné zůstane v popisu leadu.
 */
import { describeInquiry, type InquiryRecord } from "../record";
import { INTENT_LABEL_CS } from "../schema";

/** Pole `description` entity lead má v Dataverse nejvýše 2000 znaků. */
export const LEAD_DESCRIPTION_MAX = 2000;

export interface LeadFieldNames {
  /** Logický název vlastního pole pro celou konfiguraci jako JSON (volitelné). */
  configJson?: string;
  /** Logický název vlastního pole pro identifikátor poptávky z konfigurátoru (volitelné, vhodné pro deduplikaci). */
  submissionId?: string;
  /** Logický název vlastního pole pro druh zájmu (volitelné). */
  intent?: string;
}

function splitName(full: string): { firstname?: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { lastname: parts[0]! };
  return { firstname: parts.slice(0, -1).join(" "), lastname: parts.at(-1)! };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function toDataverseLead(record: InquiryRecord, fields: LeadFieldNames = {}): Record<string, string> {
  const name = splitName(record.contact.name);
  const lead: Record<string, string> = {
    subject: truncate(`Konfigurátor hal: ${INTENT_LABEL_CS[record.intent]} – ${record.contact.company}`, 300),
    ...(name.firstname ? { firstname: truncate(name.firstname, 50) } : {}),
    lastname: truncate(name.lastname, 50),
    companyname: truncate(record.contact.company, 100),
    emailaddress1: truncate(record.contact.email, 100),
    ...(record.contact.phone ? { telephone1: truncate(record.contact.phone, 50) } : {}),
    description: truncate(describeInquiry(record), LEAD_DESCRIPTION_MAX),
  };
  if (fields.configJson) lead[fields.configJson] = JSON.stringify(record.config);
  if (fields.submissionId) lead[fields.submissionId] = record.id;
  if (fields.intent) lead[fields.intent] = record.intent;
  return lead;
}
