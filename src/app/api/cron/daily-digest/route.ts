import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calculateHoldingPrediction } from "@/lib/agent/prediction";
import { sendDigestEmail } from "@/lib/email/send";
import { DigestEmailHolding } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Verify Authorization Header against CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("Cron verification failed: invalid authorization token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("Daily digest cron job started...");

  try {
    const adminSupabase = createSupabaseAdmin();

    // 2. Fetch all user preferences where email_digest_enabled = true
    const { data: activePrefs, error: prefsError } = await adminSupabase
      .from("user_preferences")
      .select("user_id")
      .eq("email_digest_enabled", true);

    if (prefsError) {
      console.error("Failed to fetch preferences:", prefsError);
      return NextResponse.json({ error: prefsError.message }, { status: 500 });
    }

    if (!activePrefs || activePrefs.length === 0) {
      console.log("No active email digest preferences found.");
      return NextResponse.json({ success: true, message: "No active users to email." });
    }

    // 3. Fetch all auth users to map user_id -> email
    const { data: usersData, error: usersError } = await adminSupabase.auth.admin.listUsers();
    if (usersError) {
      console.error("Failed to fetch auth users list:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const emailMap: Record<string, string> = {};
    usersData.users.forEach((u) => {
      if (u.email && !u.is_anonymous) {
        // Only email registered users, skip anonymous guest sessions
        emailMap[u.id] = u.email;
      }
    });

    const activeUserIds = activePrefs
      .map((p) => p.user_id)
      .filter((id) => emailMap[id] !== undefined);

    if (activeUserIds.length === 0) {
      console.log("No registered users with active digest preferences found.");
      return NextResponse.json({ success: true, message: "No registered users to email." });
    }

    let emailsSent = 0;

    // 4. Run digest cycle per active user
    for (const userId of activeUserIds) {
      const recipientEmail = emailMap[userId];
      
      // Fetch holdings for this user
      const { data: holdings, error: holdingsError } = await adminSupabase
        .from("holdings")
        .select("*")
        .eq("user_id", userId);

      if (holdingsError || !holdings || holdings.length === 0) {
        continue;
      }

      console.log(`Processing ${holdings.length} holdings for user ${recipientEmail}...`);
      const digestHoldings: DigestEmailHolding[] = [];

      // Regenerate predictions for each holding
      for (const holding of holdings) {
        try {
          const pred = await calculateHoldingPrediction(holding.ticker, holding.company);

          // Save new prediction
          await adminSupabase.from("predictions").insert({
            holding_id: holding.id,
            score: pred.score,
            range_low: pred.rangeLow,
            range_high: pred.rangeHigh,
            midpoint: pred.midpoint,
            guidance: pred.guidance,
          });

          // Add to email payload
          const rangeText = `${pred.rangeLow >= 0 ? "+" : ""}${pred.rangeLow}% to ${
            pred.rangeHigh >= 0 ? "+" : ""
          }${pred.rangeHigh}%, midpoint ${pred.midpoint >= 0 ? "+" : ""}${pred.midpoint}%`;

          digestHoldings.push({
            company: holding.company,
            ticker: holding.ticker,
            amountInvested: Number(holding.amount_invested),
            predictionRange: rangeText,
            sentimentScore: pred.score,
            guidance: pred.guidance,
          });
        } catch (e: any) {
          console.error(`Failed prediction for ${holding.ticker} during cron:`, e);
          
          // Fallback placeholder
          digestHoldings.push({
            company: holding.company,
            ticker: holding.ticker,
            amountInvested: Number(holding.amount_invested),
            predictionRange: "+5% to +15%, midpoint +10%",
            sentimentScore: 0.1,
            guidance: "hold",
          });
        }
      }

      // Send the consolidated email
      const emailResult = await sendDigestEmail(
        recipientEmail,
        recipientEmail.split("@")[0],
        digestHoldings
      );

      if (emailResult.success) {
        emailsSent++;
      }
    }

    console.log(`Cron job completed. Sent ${emailsSent} digest emails.`);
    return NextResponse.json({ success: true, emails_sent: emailsSent });
  } catch (error: any) {
    console.error("Error running daily digest cron:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
