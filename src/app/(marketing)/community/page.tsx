import { ArrowRight } from "lucide-react"

export default function CommunityPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-8 py-16">
      <div className="border-l-4 border-[var(--accent-color)] pl-8 mb-16">
        <div
          className="text-[var(--accent-color)] text-xs uppercase tracking-widest mb-3 opacity-80"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          [ COMMUNITY ]
        </div>
        <h1
          className="text-[clamp(2.5rem,5vw,4rem)] font-bold uppercase tracking-[0.02em] text-[var(--text-primary)] mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Join the Network
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-2xl">
          Connect with AI builders, get product updates, and stay ahead.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {/* Telegram */}
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-10 text-center transition-all duration-300 hover:border-[var(--accent-color)] hover:-translate-y-1 group">
          <div className="mx-auto w-16 h-16 border border-[var(--border-color)] flex items-center justify-center mb-6 group-hover:border-[var(--accent-color)] transition-colors">
            <svg className="w-8 h-8 text-[var(--accent-color)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <h2
            className="text-xl font-bold uppercase text-[var(--text-primary)] mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Telegram
          </h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
            Get instant product updates, agent deployment tips, and connect directly with our team and community members.
          </p>
          <a
            href="#"
            className="btn-primary inline-flex items-center gap-2 text-sm px-6 py-3"
          >
            Join Telegram <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* X / Twitter */}
        <div className="border border-[var(--border-color)] bg-[var(--card-bg)] p-10 text-center transition-all duration-300 hover:border-[var(--accent-color)] hover:-translate-y-1 group">
          <div className="mx-auto w-16 h-16 border border-[var(--border-color)] flex items-center justify-center mb-6 group-hover:border-[var(--accent-color)] transition-colors">
            <svg className="w-7 h-7 text-[var(--accent-color)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h2
            className="text-xl font-bold uppercase text-[var(--text-primary)] mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            X / Twitter
          </h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
            Follow us for AI operations insights, product announcements, and tips from the SovereignML team.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-sm px-6 py-3 uppercase tracking-wider font-bold transition-all"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Follow on X <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Community stat */}
      <div className="text-center border-t border-[var(--border-color)] pt-12">
        <p
          className="text-[var(--text-secondary)] text-sm"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Join <span className="text-[var(--accent-color)] font-bold">200+</span> AI builders in our growing community.
        </p>
      </div>
    </div>
  )
}
