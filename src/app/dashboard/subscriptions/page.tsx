import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  past_due: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  canceled: "bg-red-500/20 text-red-400 border-red-500/30",
  incomplete: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
}

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      plan: true,
      instance: { include: { serverConfig: true, region: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-zinc-400 mt-1">Your active and past subscriptions</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-zinc-400">No subscriptions yet. Deploy an instance to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{sub.plan.name} Plan</h3>
                    <Badge className={statusStyles[sub.status] || statusStyles.incomplete}>
                      {sub.status}
                    </Badge>
                  </div>
                  {sub.instance && (
                    <p className="text-sm text-zinc-400 mt-1">
                      {sub.instance.name} &middot; {sub.instance.region.name} &middot; {sub.instance.serverConfig.label}
                    </p>
                  )}
                </div>
                {sub.instance && (
                  <div className="text-right">
                    <p className="text-white font-semibold">
                      ${sub.interval === "year"
                        ? sub.instance.serverConfig.priceYearly.toFixed(2)
                        : sub.instance.serverConfig.priceMonthly.toFixed(2)}
                      <span className="text-zinc-500 text-sm font-normal">
                        /{sub.interval === "year" ? "yr" : "mo"}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-zinc-400">Billing</p>
                  <p className="text-white capitalize">{sub.interval === "year" ? "Yearly" : "Monthly"}</p>
                </div>
                {sub.currentPeriodEnd && (
                  <div>
                    <p className="text-zinc-400">Renews</p>
                    <p className="text-white">{sub.currentPeriodEnd.toISOString().slice(0, 10)}</p>
                  </div>
                )}
                <div>
                  <p className="text-zinc-400">Created</p>
                  <p className="text-white">{sub.createdAt.toISOString().slice(0, 10)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
