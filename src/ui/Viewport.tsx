"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useConfigStore } from "@/configurator/state/config-store";
import { computeQuantities } from "@/configurator/calculations/quantities";
import { useUiStore } from "@/configurator/state/ui-store";
import { resolveLook } from "@/scene/options";
import { SceneBoundary } from "@/scene/SceneBoundary";
import { isWebGLAvailable } from "@/scene/webgl";
import { useSceneValue, usePrefersReducedMotion } from "./hooks";
import { Plan2D } from "./Plan2D";
import { ViewToolbar } from "./ViewToolbar";
import { fmtM2, fmtNum } from "./format";

// Three.js se načítá odděleně a jen na klientu: úvodní bundle stránky zůstává malý a SSR nepotřebuje WebGL.
const HallScene = dynamic(() => import("@/scene/HallScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted" role="status">
      Načítám 3D model…
    </div>
  ),
});

function NoThreeD({ reason, onRetry }: { reason: "unsupported" | "lost" | "error"; onRetry?: () => void }) {
  const config = useConfigStore((s) => s.config);
  const text =
    reason === "unsupported"
      ? "Tento prohlížeč nepodporuje 3D grafiku (WebGL). Zobrazujeme půdorys; konfigurace, souhrn i cena fungují stejně."
      : reason === "lost"
        ? "Grafický kontext byl ztracen (např. kvůli vytížení zařízení). Zobrazujeme půdorys."
        : "3D model se nepodařilo zobrazit. Zobrazujeme půdorys.";
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="m-0 max-w-prose text-sm text-muted" role="status">
        {text}
      </p>
      {onRetry && (
        <div>
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            Zkusit 3D znovu
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Plan2D config={config} />
      </div>
    </div>
  );
}

export function Viewport() {
  const catalog = useConfigStore((s) => s.catalog);
  const liveConfig = useConfigStore((s) => s.config);
  // Posuvník zůstane plynulý: těžká 3D scéna se přepočítá s malým zpožděním.
  const config = useSceneValue(liveConfig);
  // Jen pole, která scéna opravdu čte: jiné změny stavu (průběh stavby, výběr kroku) scénu nepřekreslují.
  const ui = useUiStore(
    useShallow((s) => ({
      mode: s.mode,
      viewPreset: s.viewPreset,
      viewNonce: s.viewNonce,
      night: s.night,
      roofExploded: s.roofExploded,
      roofHidden: s.roofHidden,
      showDimensions: s.showDimensions,
      highlight: s.highlight,
      touchRotate: s.touchRotate,
      live: s.live,
      siteVisible: s.siteVisible,
      setOpenSection: s.setOpenSection,
    })),
  );
  const reduced = usePrefersReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [lost, setLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setWebgl(isWebGLAvailable()), []);
  const [debug] = useState(() => {
    if (typeof window === "undefined") return undefined;
    const q = new URLSearchParams(window.location.search);
    return { ao: q.get("ao") !== "0", fx: q.get("fx") !== "0" };
  });
  // ?cam=x,y,z,tx,ty,tz: pevná počáteční kamera pro vizuální testy a ladění.
  const [fixedPose] = useState(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("cam");
    const n = raw?.split(",").map(Number);
    return n && n.length === 6 && n.every(Number.isFinite)
      ? { position: [n[0]!, n[1]!, n[2]!] as [number, number, number], target: [n[3]!, n[4]!, n[5]!] as [number, number, number] }
      : null;
  });

  const look = useMemo(() => resolveLook(config.selections, catalog), [config.selections, catalog]);
  const quantities = computeQuantities(liveConfig);
  const product = catalog.products.find((p) => p.product_id === liveConfig.productId);

  let body;
  if (webgl === null) {
    body = (
      <div className="grid h-full place-items-center text-sm text-muted" role="status">
        Připravuji 3D…
      </div>
    );
  } else if (!webgl) {
    body = <NoThreeD reason="unsupported" />;
  } else if (lost) {
    body = (
      <NoThreeD
        reason="lost"
        onRetry={() => {
          setLost(false);
          setReady(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  } else {
    body = (
      <SceneBoundary
        key={attempt}
        onError={() => setFailed(true)}
        fallback={(reset) => <NoThreeD reason="error" onRetry={() => { setFailed(false); setReady(false); reset(); }} />}
      >
        <HallScene
          config={config}
          look={look}
          preset={ui.viewPreset}
          nonce={ui.viewNonce}
          night={ui.night}
          roofExploded={ui.roofExploded}
          roofHidden={ui.roofHidden}
          showDimensions={ui.showDimensions}
          highlight={ui.highlight}
          onPick={(s) => ui.mode === "build" && ui.setOpenSection(s)}
          onContextLost={() => setLost(true)}
          touchRotate={ui.touchRotate}
          reducedMotion={reduced}
          live={ui.live && !reduced}
          siteVisible={ui.siteVisible}
          onReady={() => setReady(true)}
          fixedPose={fixedPose}
          debug={debug}
        />
      </SceneBoundary>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="viewport">
      {body}
      {webgl && !lost && !failed && !ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-2 text-sm text-muted" role="status" aria-live="polite">
          Připravuji staveniště…
        </div>
      )}
      {webgl && !lost && !failed && ready && ui.viewPreset === "interior" && <div className="stage-scrim" aria-hidden="true" />}
      {webgl && !lost && !failed && ready && <div className="stage-toolbar"><ViewToolbar /></div>}
      {webgl && !lost && !failed && ready && <div className="stage-caption">
        <div><p className="scene-context">{ui.siteVisible ? "Ilustrativní areál" : "Váš prostor ve 3D"}</p><h2>{product?.name_cs}</h2></div>
        <dl className="scene-stats">
          <div><dt>Zastavěná plocha</dt><dd>{fmtM2(quantities.footprintAreaM2)}</dd></div>
          <div><dt>Délka × šířka</dt><dd>{fmtNum(liveConfig.dimensions.lengthM)} × {fmtNum(liveConfig.dimensions.widthM)} <span>m</span></dd></div>
          <div><dt>Světlá výška</dt><dd>{fmtNum(liveConfig.dimensions.clearHeightM, 1)} <span>m</span></dd></div>
        </dl>
      </div>}
      <p className="scene-disclaimer">Ukázkový návrh. Parametry a ceny nejsou závazné; proveditelnost vyžaduje odborné posouzení.</p>
    </div>
  );
}
