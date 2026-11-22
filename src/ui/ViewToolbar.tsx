"use client";
import { VIEW_LABELS_CS, VIEW_PRESETS } from "@/scene/camera";
import { useUiStore } from "@/configurator/state/ui-store";
import { useIsCoarsePointer, usePrefersReducedMotion } from "./hooks";
import { IconHand, IconMoon, IconPlay, IconReset, IconRuler, IconSettings, IconSkip, IconSun, IconTraffic } from "./icons";

export function ViewToolbar() {
  const ui = useUiStore();
  const coarse = useIsCoarsePointer();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="view-tools" role="toolbar" aria-label="Pohled na model">
      <div className="seg view-switch">
        <button type="button" aria-pressed={ui.viewPreset !== "interior" && ui.viewPreset !== "section" && !ui.roofHidden} onClick={() => { ui.setRoofExploded(false); ui.setViewPreset("perspective"); ui.setRoofHidden(false); }}>Exteriér</button>
        <button type="button" aria-pressed={ui.viewPreset === "interior"} onClick={() => { ui.setRoofExploded(false); ui.setViewPreset("interior"); ui.setRoofHidden(false); }}>Interiér</button>
        <button type="button" aria-pressed={ui.roofHidden} onClick={() => { ui.setRoofHidden(!ui.roofHidden); if (ui.viewPreset === "interior" || ui.viewPreset === "section") ui.setViewPreset("perspective"); }}>Bez střechy</button>
        <button type="button" aria-pressed={ui.viewPreset === "section"} onClick={() => { ui.setRoofExploded(false); ui.setRoofHidden(false); ui.setViewPreset("section"); }}>Řez</button>
      </div>
      <details className="view-options">
        <summary className="btn" aria-label="Nastavení pohledu" title="Nastavení pohledu"><IconSettings /></summary>
        <div className="view-options-menu">
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
      {!reducedMotion && <button type="button" className="btn replay-button" onClick={() => ui.requestBuild(ui.constructing ? "skip" : "replay")}>
        {ui.constructing ? <IconSkip /> : <IconPlay />}<span>{ui.constructing ? "Přeskočit stavbu" : "Přehrát stavbu"}</span>
      </button>}
    </div>
  );
}

function IconBuildSite() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 8 9-5 9 5v9l-9 4-9-4V8Zm0 0 9 5 9-5M12 13v8" /></svg>;
}
