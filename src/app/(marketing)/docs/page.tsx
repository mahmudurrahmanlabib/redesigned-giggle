"use client"

import { useState } from "react"

const faqItems = [
  {
    question: "What if my payment is not verified?",
    answer:
      "If your payment is not verified within 24 hours, please contact our support team via Telegram with your TXID and payment details. Our team will manually review the transaction and resolve any issues promptly.",
  },
  {
    question: "How long does verification take?",
    answer:
      "Payment verification typically takes between 5 to 30 minutes after submitting your TXID. During high-traffic periods, it may take up to 2 hours. You will receive a confirmation notification once verified.",
  },
  {
    question: "Can I use multiple bots?",
    answer:
      "Yes, you can subscribe to multiple bots simultaneously. Each bot requires its own $49 access fee and $10/month subscription. All bots can be managed from a single dashboard.",
  },
  {
    question: "What happens when my subscription expires?",
    answer:
      "When your monthly subscription expires, the bot will stop executing new trades. Any open positions will remain as they are. You can renew your subscription at any time to resume automated trading.",
  },
]

function FAQItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-white font-medium text-sm">{question}</span>
        <svg
          className={`w-5 h-5 text-zinc-400 shrink-0 ml-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-4">
          <p className="text-zinc-400 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl md:text-5xl font-bold text-white">Documentation</h1>
        <p className="mt-4 text-zinc-400 text-lg">
          Everything you need to get started with CopyBot Pro.
        </p>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-zinc-400 text-sm leading-relaxed">
              Getting started with CopyBot Pro is simple. Follow these steps to begin automated copy
              trading:
            </p>
            <ol className="space-y-3 text-zinc-400 text-sm leading-relaxed list-decimal list-inside">
              <li>Create an account by clicking &ldquo;Get Started&rdquo; and filling in your details.</li>
              <li>
                Choose a copy trading bot that matches your trading strategy and risk appetite.
              </li>
              <li>Complete the one-time $49 access payment via USDT (BEP20 network).</li>
              <li>Submit your transaction ID (TXID) for verification.</li>
              <li>Once verified, configure your bot settings and start trading.</li>
            </ol>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-4">Payment Process</h2>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-zinc-400 text-sm leading-relaxed">
              All payments are processed using{" "}
              <strong className="text-white">USDT on the BEP20 (Binance Smart Chain)</strong> network.
              Here is how it works:
            </p>
            <div className="space-y-3 text-zinc-400 text-sm leading-relaxed">
              <p>
                <strong className="text-zinc-200">1. Payment Address:</strong> After selecting your bot,
                you will be shown a USDT BEP20 wallet address. Send exactly the required amount to this
                address.
              </p>
              <p>
                <strong className="text-zinc-200">2. TXID Submission:</strong> After sending the payment,
                copy the transaction hash (TXID) from your wallet or exchange and paste it into the
                verification form on your dashboard.
              </p>
              <p>
                <strong className="text-zinc-200">3. Verification:</strong> Our system automatically
                verifies your transaction on the blockchain. This usually takes 5-30 minutes. You will be
                notified once your payment is confirmed.
              </p>
              <p>
                <strong className="text-zinc-200">4. Monthly Renewal:</strong> After your first month, the
                subscription renews at $10/month. You will receive a reminder before each renewal is due.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-4">Bot Usage</h2>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-zinc-400 text-sm leading-relaxed">
              Once your payment is verified, you can configure and run your bot from the dashboard.
            </p>
            <div className="space-y-3 text-zinc-400 text-sm leading-relaxed">
              <p>
                <strong className="text-zinc-200">Risk Settings:</strong> Configure your maximum position
                size, stop-loss percentage, and take-profit targets. We recommend starting with conservative
                settings and adjusting as you become more comfortable.
              </p>
              <p>
                <strong className="text-zinc-200">Expected Behavior:</strong> The bot mirrors trades from
                top-performing strategies. It operates 24/7 and executes trades automatically based on the
                signals it receives. Performance varies based on market conditions.
              </p>
              <p>
                <strong className="text-zinc-200">Monitoring:</strong> Use the real-time analytics dashboard
                to track your bot&apos;s performance, view trade history, and monitor your portfolio balance.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 pb-12" id="faq">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <FAQItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
