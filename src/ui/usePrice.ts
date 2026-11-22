"use client";
import { useCallback, useEffect, useState } from "react";
import type { HallConfig } from "@/configurator/schema/config";
import type { PriceResult } from "@/pricing/calculate";

export type PriceState =
  | { status: "loading"; stale: PriceResult | null }
  | { status: "ok"; data: PriceResult }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 300;

/**
 * Cena se vždy počítá na serveru. Hook odkládá požadavky (debounce), zrušením starého požadavku ignoruje
 * zastaralé odpovědi a při chybě NEzobrazuje poslední cenu jako cenu aktuální konfigurace.
 * Během přepočtu je k dispozici `stale` (předchozí výsledek), který UI musí označit jako zastaralý.
 */
export function usePrice(config: HallConfig): { state: PriceState; retry: () => void } {
  const [state, setState] = useState<PriceState>({ status: "loading", stale: null });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(config);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ status: "loading", stale: s.status === "ok" ? s.data : s.status === "loading" ? s.stale : null }));
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/price", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ config: JSON.parse(key) }),
          signal: controller.signal,
        });
        if (res.ok) {
          setState({ status: "ok", data: (await res.json()) as PriceResult });
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { message_cs?: string };
        setState({
          status: res.status === 422 ? "invalid" : "error",
          message: body.message_cs ?? "Cenu se nepodařilo spočítat.",
        });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: "Spojení se serverem selhalo. Cena není k dispozici." });
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
