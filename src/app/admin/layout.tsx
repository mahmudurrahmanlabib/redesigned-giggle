import { SessionProvider } from "next-auth/react"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { DashboardTopbar } from "@/components/layout/dashboard-topbar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen flex">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardTopbar />
          <main className="flex-1 p-6 lg:p-8 overflow-auto bg-[var(--bg-color)]">{children}</main>
        </div>
      </div>
    </SessionProvider>
  )
}
