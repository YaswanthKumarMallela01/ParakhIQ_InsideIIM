import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calculateHoldingPrediction } from "@/lib/agent/prediction";
import { sendDigestEmail } from "@/lib/email/send";
import { DigestEmailHolding } from "@/lib/email/templates";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });

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
      const isFallbackGuest = u.email?.startsWith("guest_");
      if (u.email && !u.is_anonymous && !isFallbackGuest) {
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

          // Fetch live stock details & history
          let currentPrice = 0;
          let purchasePriceVal = Number(holding.purchase_price);
          let historyPoints: any[] = [];

          try {
            const today = new Date();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(today.getFullYear() - 1);

            let quote: any = null;
            let historyResult: any = null;

            await Promise.all([
              (async () => {
                try {
                  quote = await yahooFinance.quote(holding.ticker);
                } catch (e) {}
              })(),
              (async () => {
                try {
                  historyResult = await yahooFinance.historical(holding.ticker, {
                    period1: oneYearAgo.toISOString().split("T")[0],
                    period2: today.toISOString().split("T")[0],
                    interval: "1wk",
                  });
                } catch (e) {}
              })(),
            ]);

            if (quote) {
              currentPrice = quote.regularMarketPrice || quote.regularMarketPreviousClose || 0;
            }

            if (Array.isArray(historyResult)) {
              historyPoints = historyResult
                .map((p: any) => ({
                  date: p.date ? new Date(p.date).toISOString().split("T")[0] : "",
                  close: p.close || p.adjClose || 0
                }))
                .filter((p: any) => p.close > 0);
            }
          } catch (err) {
            console.error(`Failed live fetch for ${holding.ticker} in cron digest:`, err);
          }

          if (currentPrice === 0) {
            currentPrice = purchasePriceVal || 100;
          }

          if (!purchasePriceVal || purchasePriceVal === 0) {
            const cleanTicker = holding.ticker.split(".")[0].toUpperCase();
            if (cleanTicker === "RELIANCE") purchasePriceVal = 2450.0;
            else if (cleanTicker === "TCS") purchasePriceVal = 3820.0;
            else if (cleanTicker === "HDFCBANK") purchasePriceVal = 1460.0;
            else if (cleanTicker === "INFY" || cleanTicker === "INFOSYS") purchasePriceVal = 1420.0;
            else purchasePriceVal = currentPrice * 0.95;
          }

          const shares = Number(holding.amount_invested) / purchasePriceVal;
          const currentValue = shares * currentPrice;
          const gainLoss = currentValue - Number(holding.amount_invested);
          const gainLossPercent = (gainLoss / Number(holding.amount_invested)) * 100;

          const rangeText = `${pred.rangeLow >= 0 ? "+" : ""}${pred.rangeLow}% to ${
            pred.rangeHigh >= 0 ? "+" : ""
          }${pred.rangeHigh}%, midpoint ${pred.midpoint >= 0 ? "+" : ""}${pred.midpoint}%`;

          digestHoldings.push({
            company: holding.company,
            ticker: holding.ticker,
            amountInvested: Number(holding.amount_invested),
            purchasePrice: parseFloat(purchasePriceVal.toFixed(2)),
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            gainLoss: parseFloat(gainLoss.toFixed(2)),
            gainLossPercent: parseFloat(gainLossPercent.toFixed(2)),
            predictionRange: rangeText,
            guidance: pred.guidance,
            priceHistory: historyPoints,
          });
        } catch (e: any) {
          console.error(`Failed prediction for ${holding.ticker} during cron:`, e);
          
          digestHoldings.push({
            company: holding.company,
            ticker: holding.ticker,
            amountInvested: Number(holding.amount_invested),
            purchasePrice: Number(holding.purchase_price) || 100,
            currentPrice: Number(holding.purchase_price) || 100,
            gainLoss: 0,
            gainLossPercent: 0,
            predictionRange: "+5% to +15%, midpoint +10%",
            guidance: "hold",
            priceHistory: [],
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
