// pan-iim-network route (TanStack Start file route). Copied as-is into the host's src/routes/.
import { createFileRoute } from "@tanstack/react-router";
import { DeskScreen } from "@/features/network";

export const Route = createFileRoute("/network_/desk")({ component: DeskScreen });
