"use client"

import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

export function DashboardTopbar() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === "admin"

  return (
    <header className="h-[70px] border-b border-[var(--border-color)] bg-[var(--card-bg)] flex items-center justify-between px-6">
      <div className="lg:hidden">
        <Link
          href="/"
          className="text-lg font-bold uppercase tracking-[0.05em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          SovereignML
        </Link>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        {isAdmin && (
          <Link href="/admin">
            <Button
              variant="outline"
              size="sm"
              className="border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-dim)] text-xs uppercase tracking-[0.05em] rounded-none"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Admin
            </Button>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-3 py-1.5 hover:bg-[var(--card-hover)] transition-colors outline-none"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {session?.user?.name || session?.user?.email || "Account"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[var(--card-bg)] border-[var(--border-color)] rounded-none">
            <DropdownMenuItem className="text-[var(--text-secondary)] text-xs rounded-none">
              {session?.user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 cursor-pointer text-xs rounded-none"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
