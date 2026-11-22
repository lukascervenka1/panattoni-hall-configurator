"use client";
import { useId, useState } from "react";
import { useUiStore, type HighlightId } from "@/configurator/state/ui-store";
import { fmtNum } from "./format";

/**
 * Číselný parametr: posuvník doplněný číselným vstupem (spec kap. 5). Posuvník mění hodnotu průběžně;
 * číselné pole přijímá rozepsaný text a potvrzuje ho při opuštění pole nebo Enter (pravidla hodnotu upraví).
 * Viditelný popisek, nápověda s rozsahem a zvýraznění příslušné části modelu při zaostření.
 */
export function ParameterField({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  highlight,
  disabled = false,
  decimals = 0,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
  highlight?: HighlightId;
  disabled?: boolean;
  decimals?: number;
}) {
  const id = useId();
  const setHighlight = useUiStore((s) => s.setHighlight);
  const [draft, setDraft] = useState<string | null>(null);
  const locked = disabled || max <= min;

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(",", "."));
    setDraft(null);
    if (Number.isFinite(n)) onChange(n);
  };
  const on = () => highlight && setHighlight(highlight);
  const off = () => highlight && setHighlight(null);

  return (
    <div className="field" onPointerEnter={on} onPointerLeave={off}>
      <label className="field-label" htmlFor={`${id}-num`}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          className="slider min-w-0 flex-1"
          aria-label={`${label} (posuvník)`}
          min={min}
          max={Math.max(max, min)}
          step={step}
          value={Math.min(Math.max(value, min), Math.max(max, min))}
          disabled={locked}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={on}
          onBlur={off}
        />
        <span className="flex items-center gap-1.5">
          <input
            id={`${id}-num`}
            type="number"
            className="num-input"
            inputMode={decimals > 0 ? "decimal" : "numeric"}
            min={min}
            max={max}
            step={step}
            value={draft ?? String(value)}
            disabled={disabled}
            aria-describedby={`${id}-hint`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              commit();
              off();
            }}
            onFocus={on}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
          <span className="w-8 text-sm text-muted">{unit}</span>
        </span>
      </div>
      <p id={`${id}-hint`} className="field-hint m-0">
        {hint ?? `Rozsah ${fmtNum(min, decimals)} až ${fmtNum(max, decimals)} ${unit}, krok ${fmtNum(step, decimals)} ${unit}.`}
      </p>
    </div>
  );
}
