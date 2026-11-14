// Module design tokens. Only Tailwind semantic classes from the host's shadcn theme, plus the three wireframe
// accent tag colours (no host equivalent; DECISIONS E-03). Change them here only.
export const tag = {
  green: "bg-[#E0ECE6] text-[#1F5C4A]",
  tan: "bg-[#F4E8D6] text-[#8A4B12]",
  lavender: "bg-[#E6E5F4] text-[#2F2F78]",
} as const;

export const avatarTones = [tag.green, tag.tan, tag.lavender] as const;

export const ui = {
  page: "mx-auto w-full max-w-xl px-4 pb-16 pt-4 text-foreground",
  card: "rounded-2xl border bg-card text-card-foreground",
  eyebrow: "text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
  h1: "text-3xl font-bold tracking-tight",
  h2: "text-xl font-bold tracking-tight",
  muted: "text-muted-foreground",
  link: "font-medium text-primary underline underline-offset-4 hover:opacity-80",
  focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
} as const;
