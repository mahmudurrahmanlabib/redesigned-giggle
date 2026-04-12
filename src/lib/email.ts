import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@copybot.pro"
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`

  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping email send")
    return { success: false, error: "Email not configured" }
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your CopyBot Pro password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #fff; background: #06060b; padding: 20px; border-radius: 12px; text-align: center;">CopyBot Pro</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
          <p style="color: #666; font-size: 13px; margin-top: 16px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to send password reset email:", error)
    return { success: false, error }
  }
}
