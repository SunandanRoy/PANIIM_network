// pan-iim-network route (TanStack Start file route). Copied as-is into the host's src/routes/.
import { createFileRoute } from "@tanstack/react-router";
import { MapScreen } from "@/features/network";

export const Route = createFileRoute("/network_/map")({
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s.focus === "string" ? s.focus : undefined,
    view: s.view === "overlap" || s.view === "list" ? (s.view as "overlap" | "list") : undefined,
  }),
  component: function Map() {
    const { focus, view } = Route.useSearch();
    return <MapScreen focusId={focus ?? null} initialView={view ?? "constellation"} />;
  },
});
