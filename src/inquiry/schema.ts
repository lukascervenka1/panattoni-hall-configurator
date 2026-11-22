/**
 * Poptávka ze konfigurátoru (spec kap. 13): kontakt, zájem, souhlas a konfigurace. Sbírají se jen potřebná data.
 * Cena ani množství v poptávce nejsou: server je vždy přepočítá z konfigurace a uloží do záznamu pro CRM.
 */
import { z } from "zod";
import { ConfigSchema } from "@/configurator/schema/config";

/** Druh zájmu: o co zákazník žádá. Seznam a směrování (kdo poptávku převezme) upřesní zadavatel. */
export const INQUIRY_INTENTS = ["order", "development_manager", "acquisition"] as const;
export type InquiryIntent = (typeof INQUIRY_INTENTS)[number];

export const INTENT_LABEL_CS: Record<InquiryIntent, string> = {
  order: "Poptávka haly podle konfigurace",
  development_manager: "Kontaktovat development managera",
  acquisition: "Kontaktovat akvizici (nabídka pozemku nebo areálu)",
};

/** Verze znění souhlasu se zpracováním osobních údajů. Skutečné znění a odkaz schválí zadavatel (kap. 19). */
export const CONSENT_TEXT_VERSION = "demo-0";

const text = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(min).max(max));

const optionalText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max))
    .optional()
    .transform((s) => (s ? s : undefined));

export const InquiryInputSchema = z.object({
  /** Identifikátor odeslání z klienta: slouží k idempotenci (opakované odeslání téhož formuláře nevytvoří duplicitu). */
  submissionId: z.string().uuid(),
  intent: z.enum(INQUIRY_INTENTS),
  contact: z.object({
    company: text(1, 120),
    name: text(2, 120),
    email: text(5, 160).pipe(z.string().email()),
    phone: optionalText(24).pipe(z.string().regex(/^[+0-9 ()./-]{6,24}$/).optional()),
  }),
  note: optionalText(1500),
  consent: z.object({ accepted: z.literal(true), textVersion: z.string().min(1).max(40) }),
  config: ConfigSchema,
  /** Past na boty: skutečný uživatel pole nevidí a nevyplní. */
  website: z.string().max(200).optional(),
});

export type InquiryInput = z.infer<typeof InquiryInputSchema>;
