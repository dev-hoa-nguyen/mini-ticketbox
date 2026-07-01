import { createFileRoute } from "@tanstack/react-router"

import { EventHero } from "@/features/tickets/ui/EventHero"

export const Route = createFileRoute("/")({ component: HomePage })

function HomePage() {
  return <EventHero />
}
