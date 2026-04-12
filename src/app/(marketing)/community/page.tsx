"use client";

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" as const },
  }),
};

export default function CommunityPage() {
  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <motion.h1
          className="text-4xl md:text-5xl font-bold text-white text-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          Join Our Community
        </motion.h1>
        <motion.p
          className="mt-4 text-zinc-400 text-lg text-center max-w-xl mx-auto"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          Connect with fellow Agentic AI users, get real-time updates, and stay ahead in the race.
        </motion.p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Telegram */}
          <motion.div
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center hover:border-blue-500/30 transition-colors"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            {/* Telegram icon */}
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-blue-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Telegram</h2>
            <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
              Get instant product updates, new model launches, and connect directly with our team and community members.
            </p>
            <a
              href="#"
              className="inline-block mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Join Telegram
            </a>
          </motion.div>

          {/* X / Twitter */}
          <motion.div
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center hover:border-zinc-500/30 transition-colors"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            {/* X icon */}
            <div className="mx-auto w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">X / Twitter</h2>
            <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
              Follow us for Agentic AI insights, product announcements, and tips from our team.
            </p>
            <a
              href="#"
              className="inline-block mt-6 border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Follow on X
            </a>
          </motion.div>
        </div>

        {/* Join us note */}
        <motion.div
          className="mt-16 text-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
        >
          <p className="text-zinc-500 text-sm">
            Join over 200+ Agentic AI users in our growing community.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
