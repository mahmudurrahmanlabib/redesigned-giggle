import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] px-5 py-10">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 30%, rgba(204,255,0,0.03) 0%, transparent 60%)" }}
      />
      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-block text-2xl font-bold uppercase tracking-[0.05em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            SovereignML
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
