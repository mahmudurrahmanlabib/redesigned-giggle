import { db, teams, memberships, users, eq, and } from "@/db"
import { createId } from "@paralleldrive/cuid2"

export const ROLES = ["owner", "admin", "developer", "viewer"] as const
export type TeamRole = (typeof ROLES)[number]

const RANK: Record<TeamRole, number> = { owner: 4, admin: 3, developer: 2, viewer: 1 }

export function canManageTeam(role: TeamRole | null | undefined): boolean {
  return role === "owner" || role === "admin"
}

export function canAssignRole(actor: TeamRole, target: TeamRole): boolean {
  // owner can assign any non-owner role; admin can only assign developer/viewer
  if (actor === "owner") return target !== "owner"
  if (actor === "admin") return target === "developer" || target === "viewer"
  return false
}

export function rankRole(role: TeamRole): number {
  return RANK[role]
}

/**
 * Returns the personal team for a user, creating one (and the owner
 * membership) on first access. Every user is the owner of exactly one
 * personal team; additional teams are not modeled in the UI yet.
 */
export async function getOrCreatePersonalTeam(userId: string) {
  const existing = await db.query.teams.findFirst({
    where: eq(teams.ownerId, userId),
  })
  if (existing) return existing

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { name: true, email: true },
  })

  const teamName = user?.name ? `${user.name}'s Team` : (user?.email?.split("@")[0] ?? "Personal") + " Team"

  return await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ id: createId(), name: teamName, ownerId: userId })
      .returning()
    await tx
      .insert(memberships)
      .values({ teamId: team.id, userId, role: "owner" })
      .onConflictDoNothing()
    return team
  })
}

/**
 * Resolves the (team, role) the current user has access to. For now this
 * is always their personal team. Returns null if user has no membership.
 */
export async function getUserTeam(userId: string): Promise<{
  teamId: string
  role: TeamRole
} | null> {
  const team = await getOrCreatePersonalTeam(userId)
  const m = await db.query.memberships.findFirst({
    where: and(eq(memberships.teamId, team.id), eq(memberships.userId, userId)),
  })
  if (!m) return null
  return { teamId: team.id, role: m.role as TeamRole }
}
