import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db, eq, and, isNull, memberships, teamInvites, users } from "@/db"
import { getOrCreatePersonalTeam, getUserTeam, type TeamRole } from "@/lib/team"
import { TeamClient } from "./team-client"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const team = await getOrCreatePersonalTeam(userId)
  const ctx = await getUserTeam(userId)
  const myRole: TeamRole = ctx?.role ?? "viewer"

  const memberRows = await db.query.memberships.findMany({
    where: eq(memberships.teamId, team.id),
    with: { user: { columns: { id: true, name: true, email: true } } },
  })

  const invites = await db.query.teamInvites.findMany({
    where: and(
      eq(teamInvites.teamId, team.id),
      isNull(teamInvites.acceptedAt),
      isNull(teamInvites.revokedAt),
    ),
  })

  const members = memberRows
    .map((m) => ({
      userId: m.userId,
      role: m.role as TeamRole,
      name: m.user?.name ?? null,
      email: m.user?.email ?? "",
    }))
    .sort((a, b) => {
      const order = { owner: 0, admin: 1, developer: 2, viewer: 3 } as const
      return order[a.role] - order[b.role]
    })

  // Suppress unused import warning when no client-fetched users surface here.
  void users

  return (
    <TeamClient
      team={{ id: team.id, name: team.name, seatLimit: team.seatLimit }}
      myRole={myRole}
      members={members}
      invites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role as TeamRole,
        expiresAt: i.expiresAt.toISOString(),
      }))}
    />
  )
}
