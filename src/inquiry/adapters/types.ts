import type { InquiryRecord } from "../record";

export type SubmitResult =
  | { status: "accepted"; reference: string; mock: boolean }
  /** `reason` je jen kód chyby (např. "crm_http_401"); osobní údaje se do chyb ani logů nikdy nezapisují. */
  | { status: "failed"; retryable: boolean; reason: string };

/** Cíl poptávek (CRM). Implementace se volí podle prostředí; demo používá jasně označený mock. */
export interface InquiryAdapter {
  readonly name: string;
  /** true = nic se skutečně neodesílá (demo); odpověď serveru to uvádí a rozhraní to musí říct zákazníkovi. */
  readonly mock: boolean;
  submit(record: InquiryRecord): Promise<SubmitResult>;
}
