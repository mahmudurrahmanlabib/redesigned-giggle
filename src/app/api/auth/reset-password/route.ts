import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"
import crypto from "crypto"

export async function POST(request: Request) {
  try {
    const { token, email, password } = await request.json()

    if (!token || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const storedToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email.toLowerCase(),
        token: hashedToken,
      },
    })

    if (!storedToken) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
    }

    if (storedToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({ where: { identifier_token: { identifier: storedToken.identifier, token: storedToken.token } } })
      return NextResponse.json({ error: "Reset link has expired. Please request a new one." }, { status: 400 })
    }

    // Update password
    const hashedPassword = hashPassword(password)
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { hashedPassword },
    })

    // Delete used token
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: storedToken.identifier, token: storedToken.token } } })

    return NextResponse.json({ message: "Password reset successfully" })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
