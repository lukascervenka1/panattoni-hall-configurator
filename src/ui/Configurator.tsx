"use client";
import { useEffect, useRef } from "react";
import type { PublicCatalog } from "@/catalog/public";
import { ConfigProvider, useConfigStore } from "@/configurator/state/config-store";
import { CONFIG_STEPS, useUiStore } from "@/configurator/state/ui-store";
import { ConceptSection, DimensionsSection, OfficeSection, OpeningsSection } from "./Controls";
import { MaterialSections } from "./MaterialSections";
import { IconArrow, IconBuild, IconEye } from "./icons";
import { PriceBreakdown, PriceHeadline } from "./PriceCard";
import { InquiryForm } from "./InquiryForm";
import { Summary } from "./Summary";
import { usePrice } from "./usePrice";
import { Viewport } from "./Viewport";

function Header() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  return (
    <header className="showroom-header">
      <a href="/" className="brand-link" aria-label="Panattoni – konfigurátor hal">
        <img src="/brand/logo-leaf-navy.svg" alt="Panattoni" width={174} height={26} />
        <span className="brand-divider" aria-hidden="true" />
        <span className="brand-product">Konfigurátor hal</span>
      </a>
      <div className="header-actions">
        <nav aria-label="Režim" className="seg mode-switch">
          <button type="button" aria-pressed={mode === "build"} onClick={() => setMode("build")}><IconBuild /><span>Stavba</span></button>
          <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}><IconEye /><span>Náhled</span></button>
        </nav>
      </div>
    </header>
  );
}

function StepNavigation() {
  const step = useUiStore((s) => s.step);
  const setStep = useUiStore((s) => s.setStep);
  return (
    <nav className="step-navigation" aria-label="Kroky konfigurace">
      {CONFIG_STEPS.map((item, i) => (
        <button key={item.section} type="button" aria-label={`${i + 1}. ${item.label}`} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>
          <span className="step-number">{i + 1}</span><span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function BuildPanel({ price }: { price: ReturnType<typeof usePrice> }) {
  const step = useUiStore((s) => s.step);
  const setStep = useUiStore((s) => s.setStep);
  const setMode = useUiStore((s) => s.setMode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const active = CONFIG_STEPS[step]!;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (previousStep.current !== step) headingRef.current?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  return (
    <>
      <div className="panel-intro"><h1>Vaše nová hala.</h1><p>Od první představy k vlastnímu prostoru.</p></div>
      <StepNavigation />
      <div className="panel-scroll" ref={scrollRef}>
        <div className="step-content" key={step}>
          <div className="step-heading"><p className="step-counter">Krok {step + 1} z {CONFIG_STEPS.length}</p><h2 ref={headingRef} tabIndex={-1}>{active.title}</h2><p>{active.description}</p></div>
          {step === 0 && <ConceptSection embedded />}
          {step === 1 && <DimensionsSection embedded />}
          {step === 2 && <OpeningsSection embedded />}
          {step === 3 && <OfficeSection embedded />}
          {step === 4 && <MaterialSections />}
        </div>
      </div>
      <div className="panel-footer">
        <PriceHeadline state={price.state} onRetry={price.retry} />
        <div className="step-actions">
          <button type="button" className="btn back-button" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Předchozí krok"><IconArrow back /></button>
          <button type="button" className="btn btn-primary next-button" onClick={() => step < CONFIG_STEPS.length - 1 ? setStep(step + 1) : setMode("preview")}>
            {step < CONFIG_STEPS.length - 1 ? "Pokračovat" : "Zobrazit konfiguraci"}<IconArrow />
          </button>
        </div>
      </div>
    </>
  );
}

function PreviewPanel({ price }: { price: ReturnType<typeof usePrice> }) {
  const setMode = useUiStore((s) => s.setMode);
  return (
    <>
      <div className="panel-intro preview-intro"><p className="step-counter">Váš návrh</p><h1>Náhled konfigurace</h1><p>Prostor přizpůsobený vašim potřebám.</p></div>
      <div className="panel-scroll preview-content"><Summary withPlan /><PriceBreakdown state={price.state} /><InquiryForm /></div>
      <div className="panel-footer"><PriceHeadline state={price.state} onRetry={price.retry} /><button type="button" className="btn btn-primary next-button" onClick={() => setMode("build")}><IconBuild />Upravit konfiguraci</button></div>
    </>
  );
}

/** Krok "Zázemí": kamera ukáže čelní část s okny, vstupem a parkovištěm i před zapnutím administrativy. */
const OFFICE_STEP = CONFIG_STEPS.findIndex((s) => s.section === "office");

function useOfficeFocus() {
  const step = useUiStore((s) => s.step);
  const enabled = useConfigStore((s) => s.config.office.enabled);
  const previous = useRef<{ step: number; enabled: boolean } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { step, enabled };
    if (step !== OFFICE_STEP) return;
    if (before && before.step === OFFICE_STEP && before.enabled === enabled) return; // už tu jsme: kamera zůstane, kde ji uživatel nechal
    const ui = useUiStore.getState();
    ui.setRoofHidden(false);
    ui.setRoofExploded(false);
    ui.setViewPreset("office");
  }, [step, enabled]);
}

function Shell() {
  const mode = useUiStore((s) => s.mode);
  const config = useConfigStore((s) => s.config);
  const price = usePrice(config);
  useOfficeFocus();
  return (
    <div className="showroom-shell">
      <Header />
      <main className="workspace" data-mode={mode}>
        <section className="stage" aria-label="3D náhled haly"><Viewport /></section>
        <div className="panel" role="region" aria-label={mode === "build" ? "Konfigurace" : "Náhled a souhrn"}>
          {mode === "build" ? <BuildPanel price={price} /> : <PreviewPanel price={price} />}
        </div>
      </main>
    </div>
  );
}

export function Configurator({ catalog }: { catalog: PublicCatalog }) {
  return <ConfigProvider catalog={catalog}><Shell /></ConfigProvider>;
}
