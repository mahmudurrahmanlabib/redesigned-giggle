import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function SshKeysPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const keys = await prisma.sshKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">SSH Keys</h1>
        <p className="text-zinc-400 mt-1">Manage SSH keys for your deployments</p>
      </div>

      {keys.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-zinc-400">No SSH keys yet. Keys are automatically added when you deploy with an SSH key.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="bg-white/5 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{key.name}</p>
                  <p className="text-xs text-zinc-500 font-mono mt-1">{key.fingerprint}</p>
                </div>
                <p className="text-xs text-zinc-500">{key.createdAt.toISOString().slice(0, 10)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
