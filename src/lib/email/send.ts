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

export async function sendOtpEmail(toEmail: string, otp: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your ParakhIQ Account</title>
      </head>
      <body style="background-color: #131315; color: #e5e1e4; margin: 0; padding: 20px; font-family: 'Inter', sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #0e0e10; border: 1px solid #27272a; border-radius: 8px; padding: 32px; text-align: center;">
          
          <!-- Logo -->
          <div style="margin-bottom: 24px;">
            <div style="width: 40px; height: 40px; background-color: #10b981; margin: 0 auto 12px auto; display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
              <span style="transform: rotate(-45deg); font-family: sans-serif; font-weight: bold; font-size: 18px; color: #003824;">P</span>
            </div>
            <h1 style="color: #10b981; margin: 0; font-family: sans-serif; font-size: 20px; letter-spacing: 0.05em; font-weight: 700; text-transform: uppercase;">
              ParakhIQ Terminal
            </h1>
          </div>

          <!-- Body -->
          <h2 style="color: #e5e1e4; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
            Verify Your Registration
          </h2>
          <p style="color: #bbcabf; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
            Thank you for registering at ParakhIQ. Please use the following 6-digit One-Time Password (OTP) to complete your account verification. This code is valid for 10 minutes.
          </p>

          <!-- OTP Box -->
          <div style="background-color: #1c1b1d; border: 1px solid #3c4a42; border-radius: 6px; padding: 20px; margin: 24px 0; font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 0.25em; color: #10b981; text-align: center;">
            ${otp}
          </div>

          <p style="color: #bbcabf; font-size: 11px; line-height: 1.5; margin-top: 24px;">
            If you did not request this verification, you can safely ignore this email.
          </p>

          <!-- Footer -->
          <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 32px; color: #71717a; font-size: 10px;">
            <p style="margin: 0;">
              Disclaimer: ParakhIQ is an AI research tool, not financial advice.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"ParakhIQ Security" <${user}>`,
      to: toEmail,
      subject: `[ParakhIQ] Account Verification Code: ${otp}`,
      html,
    });

    console.log("OTP email sent successfully to:", toEmail, "Message ID:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Error sending OTP email:", error);
    return { success: false, error: error.message || error };
  }
}
