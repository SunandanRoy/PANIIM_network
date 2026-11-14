// pan-iim-network route (TanStack Start file route). Copied as-is into the host's src/routes/.
import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/features/network";

export const Route = createFileRoute("/network_/people/$id")({
  component: function Person() {
    const { id } = Route.useParams();
    return <ProfileScreen personId={id} />;
  },
});
