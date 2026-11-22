"use client";
import { Component, type ReactNode } from "react";

/** Zachytí chybu při vykreslení 3D (např. selhání inicializace) a místo prázdné stránky zobrazí náhradní obsah bez 3D. */
export class SceneBoundary extends Component<{ fallback: (reset: () => void) => ReactNode; children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.();
    // Nelogujeme obsah konfigurace; stačí typ chyby pro diagnostiku.
    console.error("3D scéna selhala:", error instanceof Error ? error.message : "neznámá chyba");
  }

  render() {
    if (this.state.failed) return this.props.fallback(() => this.setState({ failed: false }));
    return this.props.children;
  }
}
