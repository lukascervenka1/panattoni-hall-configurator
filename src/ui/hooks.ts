"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  };
}

/** prefers-reduced-motion (spec kap. 7). Na serveru false, na klientu skutečná hodnota bez bliknutí. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMedia("(prefers-reduced-motion: reduce)"),
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeMedia("(pointer: coarse)"),
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

/** Leading/trailing rate limit for expensive scene work; form fields and prices remain immediate. */
export function useSceneValue<T>(value: T, intervalMs = 120): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const appliedAt = useRef(0);
  latest.current = value;
  useEffect(() => {
    const remaining = Math.max(0, intervalMs - (performance.now() - appliedAt.current));
    const timer = window.setTimeout(() => {
      appliedAt.current = performance.now();
      setShown(latest.current);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [value, intervalMs]);
  return shown;
}
