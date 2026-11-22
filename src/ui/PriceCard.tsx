"use client";
import { formatMoney } from "@/pricing/money";
import { fmtNum, UNIT_LABEL_CS } from "./format";
import type { PriceState } from "./usePrice";

/**
 * Orientační cena ze serveru. Zásady (spec kap. 12):
 * - neúplný ceník se NEvydává za celkovou cenu: je to označený dílčí součet + "vyžaduje individuální kalkulaci",
 * - při chybě serveru se nezobrazuje poslední cena,
 * - během přepočtu je předchozí hodnota označena jako zastaralá.
 */
export function PriceHeadline({ state, onRetry }: { state: PriceState; onRetry: () => void }) {
  if (state.status === "error" || state.status === "invalid") {
    return (
      <div role="alert" className="grid gap-1.5">
        <p className="m-0 font-semibold text-[color:var(--danger)]">Cena není k dispozici</p>
        <p className="m-0 text-sm text-muted">{state.message}</p>
        {state.status === "error" && (
          <div>
            <button type="button" className="btn btn-sm" onClick={onRetry}>
              Zkusit znovu
            </button>
          </div>
        )}
      </div>
    );
  }

  const data = state.status === "ok" ? state.data : state.stale;
  const loading = state.status === "loading";
  if (!data) {
    return (
      <p className="m-0 text-sm text-muted" role="status" aria-live="polite">
        Počítám orientační cenu…
      </p>
    );
  }
  return (
    <div className="grid gap-1" aria-busy={loading} data-testid="price-headline">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-muted">
          {data.isComplete ? "Orientační cena realizace" : "Dílčí součet (orientační)"} · bez DPH
        </span>
        <span className="chip">DEMO</span>
      </div>
      <p className={`num m-0 font-[family-name:var(--font-display)] text-[28px] font-semibold leading-tight ${loading ? "opacity-50" : ""}`} data-testid="price-value">
        {formatMoney(data.subtotalCents, data.currency)}
      </p>
      <p className="m-0 text-[13px] text-muted" role="status" aria-live="polite">
        {loading ? "Přepočítávám… zobrazená hodnota je z předchozí konfigurace." : data.isComplete ? "Cena nezávazná." : "Celková cena vyžaduje individuální kalkulaci."}
      </p>
    </div>
  );
}

export function PriceBreakdown({ state }: { state: PriceState }) {
  const data = state.status === "ok" ? state.data : null;
  if (!data) return null;
  return (
    <div className="grid gap-4">
      <details className="rounded-lg border border-line bg-surface">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Rozpis položek</summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Rozpis orientační ceny podle stavebních částí</caption>
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="py-1.5 pr-2 font-semibold">
                  Položka
                </th>
                <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
                  Množství
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold">
                  Mezisoučet
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l, i) => (
                <tr key={`${l.optionId}-${i}`} className="border-t border-line align-top">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <span className="block font-semibold">{l.categoryName}</span>
                    <span className="block text-[13px] text-muted">
                      {l.optionName}
                      {l.priceMode === "surcharge" ? " (příplatek)" : ""}
                    </span>
                  </th>
                  <td className="num whitespace-nowrap py-1.5 pr-2 text-right">
                    {l.status === "priced" && l.unit ? `${fmtNum(l.quantity, 2)} ${UNIT_LABEL_CS[l.unit] ?? l.unit}` : "–"}
                  </td>
                  <td className="num py-1.5 text-right font-semibold">
                    {l.amountCents === null ? <span className="font-normal text-muted">individuální kalkulace</span> : formatMoney(l.amountCents, data.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line">
                <th scope="row" colSpan={2} className="py-2 text-left">
                  {data.isComplete ? "Celkem" : "Dílčí součet"} bez DPH
                </th>
                <td className="num py-2 text-right font-semibold">{formatMoney(data.subtotalCents, data.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>

      {data.incompleteReasons.length > 0 && (
        <div className="rounded-lg border border-[color:var(--warn-line)] bg-[color:var(--warn-bg)] p-3 text-sm text-[color:var(--warn-text)]">
          <p className="m-0 mb-1 font-semibold">Co cena nezahrnuje</p>
          <ul className="m-0 list-disc pl-5">
            {data.incompleteReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="m-0 list-disc pl-5 text-[13px] text-muted">
        {data.reservations.map((r) => (
          <li key={r}>{r}</li>
        ))}
        <li className="num">
          Katalog: {data.catalogVersion.label} ({data.catalogVersion.id}). Konfigurace zůstává připnutá k této verzi ceníku.
        </li>
      </ul>
    </div>
  );
}
