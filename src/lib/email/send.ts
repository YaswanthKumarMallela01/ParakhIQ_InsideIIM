import nodemailer from "nodemailer";
import { getDigestEmailHtml, DigestEmailHolding } from "./templates";

export async function sendDigestEmail(
  toEmail: string,
  userName: string,
  holdings: DigestEmailHolding[]
) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!user || !pass) {
    console.error("Email credentials missing in environment variables.");
    return { success: false, error: "SMTP credentials not configured" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  const html = getDigestEmailHtml(userName, holdings, appUrl);

  try {
    const info = await transporter.sendMail({
      from: `"ParakhIQ Agent" <${user}>`,
      to: toEmail,
      subject: `[ParakhIQ] Your Daily Portfolio Digest — ${holdings.length} holdings`,
      html,
    });

    console.log("Digest email sent successfully to:", toEmail, "Message ID:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Error sending digest email:", error);
    return { success: false, error: error.message || error };
  }
}
