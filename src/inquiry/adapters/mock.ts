import type { InquiryRecord } from "../record";
import type { InquiryAdapter, SubmitResult } from "./types";

/**
 * Demo adaptér: poptávku nikam neodešle, neukládá ji a nic z ní nezapisuje do logu. Vrací jen označenou referenci,
 * aby šlo vyzkoušet celý tok. Nikdy se nevydává za skutečné odeslání (spec kap. 13).
 */
export function createMockAdapter(): InquiryAdapter {
  return {
    name: "mock",
    mock: true,
    async submit(record: InquiryRecord): Promise<SubmitResult> {
      return { status: "accepted", reference: `DEMO-${record.id.slice(0, 8).toUpperCase()}`, mock: true };
    },
  };
}
