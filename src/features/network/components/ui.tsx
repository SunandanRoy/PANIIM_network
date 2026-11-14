// Small primitives styled only with the host's shadcn semantic tokens (DECISIONS E-02). Tap targets >= 44 px.
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { avatarTones, ui } from "../lib/tokens";
import { initials } from "../lib/format";

type Variant = "primary" | "outline" | "ghost" | "danger" | "dark";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
  ghost: "text-primary hover:bg-accent",
  danger: "border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
  dark: "bg-foreground text-background hover:opacity-90",
};

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${ui.focus} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, colour, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; colour?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition ${
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-accent"
      } ${ui.focus} ${className}`}
    >
      {colour && <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colour }} />}
      {children}
      {active && colour && <span aria-hidden>✓</span>}
    </button>
  );
}

export function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium ${tone}`}>{children}</span>;
}

export function Card({ className = "", children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`${ui.card} ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={ui.eyebrow}>{children}</p>;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, photo, size = 48, id }: { name: string; photo?: string | null; size?: number; id?: string }) {
  const tone = avatarTones[hash(id ?? name) % avatarTones.length];
  if (photo) {
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tone}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-lg px-3 text-[15px] font-semibold transition ${value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"} ${ui.focus}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on desktop. Esc closes; focus returns to the opener. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 text-foreground shadow-xl outline-none sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className={ui.h2}>{title}</h2>
          <Button variant="outline" onClick={onClose} aria-label="Close">Close</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-muted motion-reduce:animate-none ${className}`} />;
}

export function BackBar({ onBack, label }: { onBack: () => void; label?: string }) {
  return (
    <div className="flex min-h-11 items-center gap-1">
      <button type="button" onClick={onBack} aria-label="Back" className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-accent ${ui.focus}`}>
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      {label && <span className="font-semibold">{label}</span>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-4">
      <p className="text-sm">{message}</p>
      {onRetry && <Button variant="outline" className="mt-3" onClick={onRetry}>Try again</Button>}
    </Card>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const inputClass = `min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] placeholder:text-muted-foreground ${ui.focus}`;

export function Toggle({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-semibold">{label}</label>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-11 w-[68px] shrink-0 items-center rounded-full border-2 transition ${checked ? "border-primary bg-primary" : "border-input bg-muted"} ${ui.focus}`}
      >
        <span className={`ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-card text-[11px] font-bold shadow transition ${checked ? "translate-x-6 text-primary" : "text-muted-foreground"}`}>
          {checked ? "On" : "Off"}
        </span>
      </button>
    </div>
  );
}
