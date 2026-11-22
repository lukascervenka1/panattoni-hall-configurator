"use client";
import { useId, type ReactNode } from "react";
import { useUiStore, type SectionId } from "@/configurator/state/ui-store";
import { IconChevron } from "./icons";

/** Postupně odkrývaná sekce (akordeon). Najednou je otevřená jedna, aby panel zůstal klidný. */
export function Section({ id, title, summary, children, embedded = false }: { id: SectionId; title: string; summary?: string; children: ReactNode; embedded?: boolean }) {
  const open = useUiStore((s) => s.openSection === id);
  const setOpen = useUiStore((s) => s.setOpenSection);
  const uid = useId();
  if (embedded) return <section className="guided-section" data-section={id} aria-label={title}>{children}</section>;
  return (
    <section className="panel-section" data-section={id}>
      <h2 className="m-0">
        <button
          type="button"
          className="section-head"
          aria-expanded={open}
          aria-controls={`${uid}-body`}
          id={`${uid}-head`}
          onClick={() => setOpen(open ? null : id)}
        >
          <span className="grid gap-0.5">
            <span className="section-title">{title}</span>
            {summary && <span className="section-sub num">{summary}</span>}
          </span>
          <IconChevron open={open} />
        </button>
      </h2>
      {open && (
        <div id={`${uid}-body`} role="region" aria-labelledby={`${uid}-head`} className="grid gap-5 px-5 pb-6 pt-1">
          {children}
        </div>
      )}
    </section>
  );
}
