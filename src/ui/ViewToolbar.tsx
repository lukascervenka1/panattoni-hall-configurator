"use client";
import { useEffect, useRef } from "react";
import { VIEW_LABELS_CS, VIEW_PRESETS } from "@/scene/camera";
import { useUiStore } from "@/configurator/state/ui-store";
import { useIsCoarsePointer, usePrefersReducedMotion } from "./hooks";
import { IconHand, IconMoon, IconReset, IconRuler, IconSettings, IconSun, IconTraffic } from "./icons";

export function ViewToolbar() {
  const ui = useUiStore();
  const coarse = useIsCoarsePointer();
  const reducedMotion = usePrefersReducedMotion();
  const options = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const details = options.current;
    const panel = menu.current;
    const viewport = details?.closest<HTMLElement>('[data-testid="viewport"]');
    const toolbar = details?.parentElement;
    if (!details || !panel || !viewport || !toolbar) return;
    // The 3D viewport clips its overlays. Measure from the actual menu position,
    // including a wrapped toolbar, rather than sizing the menu against the whole phone screen.
    const fitMenu = () => {
      if (!details.open) return;
      const available = viewport.getBoundingClientRect().bottom - panel.getBoundingClientRect().top - 12;
      panel.style.setProperty("--view-menu-available", `${Math.max(0, available)}px`);
    };
    const observer = new ResizeObserver(fitMenu);
    observer.observe(viewport);
    observer.observe(toolbar);
    details.addEventListener("toggle", fitMenu);
    fitMenu();
    return () => {
      observer.disconnect();
      details.removeEventListener("toggle", fitMenu);
    };
  }, []);

  return (
    <div className="view-tools" role="toolbar" aria-label="Pohled na model">
      <div className="seg view-switch">
        <button type="button" aria-pressed={ui.viewPreset !== "interior" && ui.viewPreset !== "section" && !ui.roofHidden} onClick={() => { ui.setRoofExploded(false); ui.setViewPreset("perspective"); ui.setRoofHidden(false); }}>Exteriér</button>
        <button type="button" aria-pressed={ui.viewPreset === "interior"} onClick={() => { ui.setRoofExploded(false); ui.setViewPreset("interior"); ui.setRoofHidden(false); }}>Interiér</button>
        <button type="button" aria-pressed={ui.roofHidden} onClick={() => { ui.setRoofHidden(!ui.roofHidden); if (ui.viewPreset === "interior" || ui.viewPreset === "section") ui.setViewPreset("perspective"); }}>Bez střechy</button>
        <button type="button" aria-pressed={ui.viewPreset === "section"} onClick={() => { ui.setRoofExploded(false); ui.setRoofHidden(false); ui.setViewPreset("section"); }}>Řez</button>
      </div>
      <details ref={options} className="view-options">
        <summary className="btn" aria-label="Nastavení pohledu" title="Nastavení pohledu"><IconSettings /></summary>
        <div ref={menu} className="view-options-menu" tabIndex={0} role="region" aria-label="Nastavení pohledu na halu">
          <span className="field-label">Pohled na halu</span>
          <div className="camera-options" role="radiogroup" aria-label="Pohled kamery">
            {VIEW_PRESETS.map((v) => <button key={v} type="button" role="radio" aria-checked={ui.viewPreset === v} onClick={() => ui.setViewPreset(v)}>{VIEW_LABELS_CS[v]}</button>)}
          </div>
          <button type="button" className="btn" onClick={ui.resetView}><IconReset />Výchozí pohled</button>
          <button type="button" className="btn" aria-pressed={ui.showDimensions} onClick={() => ui.setShowDimensions(!ui.showDimensions)}><IconRuler />Rozměry</button>
          <button type="button" className="btn" aria-pressed={ui.night} onClick={() => ui.setNight(!ui.night)}>{ui.night ? <IconMoon /> : <IconSun />}Večer</button>
          <button type="button" className="btn" aria-pressed={ui.siteVisible} onClick={() => ui.setSiteVisible(!ui.siteVisible)}><IconBuildSite />Zobrazit areál</button>
          {!reducedMotion && <button type="button" className="btn" aria-pressed={ui.live} onClick={() => ui.setLive(!ui.live)}><IconTraffic />Provoz</button>}
          {coarse && <button type="button" className="btn" aria-pressed={ui.touchRotate} onClick={() => ui.setTouchRotate(!ui.touchRotate)}><IconHand />Otáčet model</button>}
        </div>
      </details>
    </div>
  );
}

function IconBuildSite() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 8 9-5 9 5v9l-9 4-9-4V8Zm0 0 9 5 9-5M12 13v8" /></svg>;
}
