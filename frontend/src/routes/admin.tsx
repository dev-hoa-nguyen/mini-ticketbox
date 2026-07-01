import { createFileRoute } from "@tanstack/react-router"

import { AdminDashboard } from "@/features/admin/ui/AdminDashboard"

export const Route = createFileRoute("/admin")({ component: AdminPage })

function AdminPage() {
  return <AdminDashboard />
}
