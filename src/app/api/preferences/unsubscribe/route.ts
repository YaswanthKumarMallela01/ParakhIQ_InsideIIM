import { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response("Missing email parameter", { status: 400 });
  }

  const adminSupabase = createSupabaseAdmin();

  try {
    const { data: usersList, error: listError } = await adminSupabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = usersList.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const { error: updateError } = await adminSupabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        email_digest_enabled: false,
      });

    if (updateError) throw updateError;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Unsubscribed — ParakhIQ</title>
          <style>
            body {
              background-color: #131315;
              color: #e5e1e4;
              font-family: monospace;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .card {
              max-width: 480px;
              width: 100%;
              background-color: #1c1b1d;
              border: 1px solid #3c4a42;
              border-radius: 8px;
              padding: 32px;
              text-align: center;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            h1 {
              color: #10b981;
              font-size: 18px;
              margin-bottom: 16px;
              letter-spacing: 0.05em;
            }
            p {
              font-size: 12px;
              line-height: 1.6;
              color: #bbcabf;
              margin-bottom: 24px;
            }
            .btn {
              background-color: #10b981;
              color: #003824;
              text-decoration: none;
              padding: 10px 20px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 12px;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>[STATUS] UNSUBSCRIBED SUCCESSFULLY</h1>
            <p>
              Your email address (<strong>${email}</strong>) has been unsubscribed from the ParakhIQ Daily morning portfolio digests. You will no longer receive daily email updates.
            </p>
            <p>
              You can re-enable this feature at any time from your account settings panel.
            </p>
            <a href="/" class="btn">GO TO TERMINAL</a>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err: any) {
    return new Response(`Unsubscribe failed: ${err.message || err}`, { status: 500 });
  }
}
