"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getReducedMotionServerSnapshot() {
  return false
}

type TerminalLine = {
  text: string
  delay: number
  command?: boolean
}

const TERMINAL_LINES: TerminalLine[] = [
  { text: "> INITIALIZING SOVEREIGN_ML v3.2.1...", delay: 800 },
  { text: "> LOADING AGENT FRAMEWORK...", delay: 400 },
  { text: "  [OK] Agent runtime loaded", delay: 300 },
  { text: "  [OK] Model registry connected", delay: 300 },
  { text: "  [OK] Vector store initialized", delay: 300 },
  { text: "> CONFIGURING SUPPORT AGENT...", delay: 600 },
  { text: "  model: llama-3-70b", delay: 200 },
  { text: "  strategy: qlora", delay: 200 },
  { text: "  privacy: strict", delay: 200 },
  { text: "", delay: 100, command: true },
  { text: "user@sovereign:~$ sovereignml deploy --agent support", delay: 0, command: true },
  { text: "", delay: 600 },
  { text: "> DEPLOYING TO PRODUCTION...", delay: 500 },
  { text: "  [============================] 100%", delay: 800 },
  { text: "  Endpoint: https://api.sovereignml.com/v1/agent/sup-7x2k", delay: 300 },
  { text: "", delay: 200 },
  { text: "> STATUS: AGENT_ONLINE", delay: 400 },
  { text: "> LATENCY: 42ms | UPTIME: 99.99%", delay: 300 },
  { text: "> READY FOR REQUESTS", delay: 500 },
]

export function TerminalAnimation() {
  const [lines, setLines] = useState<string[]>([])
  const containerRef = useRef<HTMLPreElement>(null)
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )

  useEffect(() => {
    if (reducedMotion) {
      setLines(TERMINAL_LINES.map((l) => l.text))
      return
    }

    let alive = true
    const timeouts: ReturnType<typeof setTimeout>[] = []
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (alive) fn()
      }, ms)
      timeouts.push(id)
    }

    let currentLine = 0
    let currentChar = 0
    let currentText = ""

    function processLine() {
      if (!alive || currentLine >= TERMINAL_LINES.length) return

      const line = TERMINAL_LINES[currentLine]!

      if (line.command && line.text.includes("user@sovereign")) {
        if (currentChar === 0) currentText = ""
        if (currentChar < line.text.length) {
          currentText += line.text[currentChar]!
          currentChar++
          setLines((prev) => {
            const next = [...prev]
            next[currentLine] = currentText
            return next
          })
          schedule(processLine, 30 + Math.random() * 50)
          return
        }
        currentChar = 0
        currentLine++
        schedule(processLine, 400)
        return
      }

      setLines((prev) => [...prev, line.text])
      currentLine++
      schedule(processLine, line.delay)
    }

    schedule(processLine, 350)

    return () => {
      alive = false
      for (const id of timeouts) clearTimeout(id)
    }
  }, [reducedMotion])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  return (
    <div
      className="relative border border-[var(--border-color)] bg-[var(--code-bg)] overflow-hidden"
      style={{
        clipPath:
          "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
      }}
    >
      <div className="absolute top-0 left-0 w-full h-[20%] bg-gradient-to-b from-transparent via-[rgba(204,255,0,0.08)] to-transparent animate-[scanline_3s_linear_infinite] pointer-events-none z-10" />
      <pre
        ref={containerRef}
        className="p-4 sm:p-6 font-[var(--font-mono)] text-[0.7rem] sm:text-[0.8rem] text-[var(--accent-color)] whitespace-pre-wrap h-[min(400px,55vh)] sm:h-[400px] overflow-y-auto leading-relaxed"
      >
        {lines.map((line, i) => (
          <div key={i}>
            {line.includes("user@sovereign") ? (
              <>
                <span className="text-[#CCFF00]">user@sovereign:~$</span>
                <span className="text-[var(--text-primary)]">
                  {line.replace("user@sovereign:~$", "")}
                </span>
              </>
            ) : line.includes("[OK]") ? (
              <span className="text-[#27c93f]">{line}</span>
            ) : line.includes("STATUS: AGENT_ONLINE") ? (
              <span className="text-[#CCFF00] font-bold">{line}</span>
            ) : (
              <span className="text-[var(--text-secondary)]">{line}</span>
            )}
          </div>
        ))}
        <span className="inline-block animate-[blink_1s_step-end_infinite] text-[var(--accent-color)]">
          ▋
        </span>
      </pre>
    </div>
  )
}
