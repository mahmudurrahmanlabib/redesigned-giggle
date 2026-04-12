import type { Metadata } from "next"
import { Rajdhani, Outfit, Space_Mono } from "next/font/google"
import { AppProviders } from "@/components/app-providers"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const outfit = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "SovereignML — Launch AI Agents That Actually Work",
  description: "The AI operations platform. Deploy intelligent agents that automate real tasks — support, DevOps, sales, content, and more. Full ownership, zero complexity.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${outfit.variable} ${spaceMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  )
}
