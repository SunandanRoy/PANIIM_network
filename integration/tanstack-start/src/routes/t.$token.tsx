// pan-iim-network route (TanStack Start file route). Copied as-is into the host's src/routes/.
import { createFileRoute } from "@tanstack/react-router";
import { TapScreen } from "@/features/network";

export const Route = createFileRoute("/t/$token")({
  validateSearch: (s: Record<string, unknown>) => ({ src: s.src === "scan" ? ("scan" as const) : undefined }),
  component: function Tap() {
    const { token } = Route.useParams();
    const { src } = Route.useSearch();
    return <TapScreen token={token} source={src === "scan" ? "scan" : "tap"} />;
  },
});
