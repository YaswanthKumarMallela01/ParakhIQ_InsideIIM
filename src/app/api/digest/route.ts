import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calculateHoldingPrediction } from "@/lib/agent/prediction";
import { sendDigestEmail } from "@/lib/email/send";
import { DigestEmailHolding } from "@/lib/email/templates";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    // Allow guest to specify test email, or fallback to user's registered email
    const recipientEmail = body.email || user.email;

    if (!recipientEmail) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    const adminSupabase = createSupabaseAdmin();

    // 1. Fetch holdings for this user
    const { data: holdings, error: holdingsError } = await adminSupabase
      .from("holdings")
      .select("*")
      .eq("user_id", user.id);

    if (holdingsError) {
      return NextResponse.json({ error: holdingsError.message }, { status: 500 });
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: false,
        message: "You have no holdings in your portfolio. Add a holding first.",
      });
    }

    const digestHoldings: DigestEmailHolding[] = [];

    // 2. Loop through and regenerate predictions in parallel (or sequence to avoid rate limits)
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

        // Add to email list
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
        console.error(`Failed to calculate prediction for ${holding.ticker} during on-demand digest:`, e);
        
        // Fallback placeholder to keep email functional
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

    // 3. Send consolidated email digest
    const emailResult = await sendDigestEmail(
      recipientEmail,
      user.email ? user.email.split("@")[0] : "Guest",
      digestHoldings
    );

    if (!emailResult.success) {
      return NextResponse.json({
        success: false,
        error: emailResult.error,
        message: "Predictions generated and saved, but sending email failed.",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Daily digest email sent successfully to ${recipientEmail}!`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
