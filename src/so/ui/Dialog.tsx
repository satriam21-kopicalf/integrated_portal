"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { tr } from "@/lib/i18n";
import { Button, Field, inputClass } from "./index";

/** Centered modal (bottom sheet on phones), same as integrated_portal. Escape / backdrop close unless `locked`. */
export default function Dialog({
  open, title, description, onClose, children, footer, size = "md", locked = false,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  locked?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  useEffect(() => {
    closeRef.current = onClose;
    lockedRef.current = locked;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lockedRef.current) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea");
    (first ?? panel.current)?.focus();
  }, [open]);

  if (!open) return null;
  const width = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size];
  return (
    <div className="fixed inset-0 z-[85] !m-0 flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] dark:bg-black/70" onClick={locked ? undefined : onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl ${width}`}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {!locked && (
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tr("Close")}>
              <X size={18} />
            </button>
          )}
        </header>
        {children && <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/**
 * Confirmation (replaces window.confirm / prompt). With `reasonLabel` it also asks for an optional note,
 * handed to onConfirm.
 */
export function ConfirmDialog({
  open, title, description, confirmLabel, danger = false, reasonLabel, busy, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reasonLabel?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button>
        </>
      }>
      {reasonLabel && (
        <Field label={reasonLabel}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputClass} h-auto py-2`} />
        </Field>
      )}
    </Dialog>
  );
}
