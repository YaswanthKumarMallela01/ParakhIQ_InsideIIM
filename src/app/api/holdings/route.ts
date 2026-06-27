import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { calculateHoldingPrediction } from "@/lib/agent/prediction";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();

  // Get current session user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get holdings for this user
    const { data: holdings, error: holdingsError } = await supabase
      .from("holdings")
      .select("*, predictions(*)")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    if (holdingsError) {
      return NextResponse.json({ error: holdingsError.message }, { status: 500 });
    }

    // Format holdings to return current price, purchase price, P&L, and price history
    const formattedHoldings = await Promise.all(
      holdings.map(async (holding) => {
        let currentPrice = 0;
        let purchasePriceVal = Number(holding.purchase_price);
        let historyPoints: any[] = [];
        const currencySymbol = (holding.ticker.endsWith(".NS") || holding.ticker.endsWith(".BO")) ? "₹" : "$";

        try {
          const today = new Date();
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(today.getFullYear() - 1);

          // Fetch current price quote and weekly history for line chart
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
                close: p.close || p.adjClose || 0,
              }))
              .filter((p: any) => p.date && p.close > 0);
          }
        } catch (err) {
          console.error(`Failed to fetch Live Data for ${holding.ticker}:`, err);
        }

        // Default currentPrice if failed
        if (currentPrice === 0) {
          currentPrice = purchasePriceVal || 100;
        }

        // Default purchasePrice if null (for old seeded guest holdings or failed fetches)
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

        // Sort predictions descending to get the latest
        const preds = holding.predictions || [];
        const sortedPreds = preds.sort(
          (a: any, b: any) =>
            new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
        );
        const latestPrediction = sortedPreds[0] || null;

        const { predictions, ...holdingData } = holding;

        return {
          ...holdingData,
          current_price: parseFloat(currentPrice.toFixed(2)),
          purchase_price: parseFloat(purchasePriceVal.toFixed(2)),
          shares: parseFloat(shares.toFixed(4)),
          current_value: parseFloat(currentValue.toFixed(2)),
          gain_loss: parseFloat(gainLoss.toFixed(2)),
          gain_loss_percent: parseFloat(gainLossPercent.toFixed(2)),
          priceHistory: historyPoints,
          latestPrediction,
          currencySymbol,
        };
      })
    );

    return NextResponse.json(formattedHoldings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { company, ticker, amountInvested } = await request.json();

    if (!company || !ticker || !amountInvested) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch the current price today to store as the purchase price
    let purchasePrice: number | null = null;
    try {
      const quote = (await yahooFinance.quote(ticker)) as any;
      if (quote) {
        purchasePrice = quote.regularMarketPrice || quote.regularMarketPreviousClose || null;
      }
    } catch (e) {
      console.error("Failed to resolve purchase price quote:", e);
    }

    // 1. Insert into holdings
    const { data: newHolding, error: insertError } = await supabase
      .from("holdings")
      .insert({
        user_id: user.id,
        company,
        ticker,
        amount_invested: Number(amountInvested),
        purchase_price: purchasePrice,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 2. Immediately trigger 1Y prediction calculation
    let predictionResult;
    try {
      predictionResult = await calculateHoldingPrediction(ticker, company);

      const adminSupabase = createSupabaseAdmin();
      await adminSupabase.from("predictions").insert({
        holding_id: newHolding.id,
        score: predictionResult.score,
        range_low: predictionResult.rangeLow,
        range_high: predictionResult.rangeHigh,
        midpoint: predictionResult.midpoint,
        guidance: predictionResult.guidance,
      });
    } catch (e: any) {
      console.error("Failed to compute prediction on insert:", e);
      const adminSupabase = createSupabaseAdmin();
      await adminSupabase.from("predictions").insert({
        holding_id: newHolding.id,
        score: 0.1,
        range_low: 3,
        range_high: 17,
        midpoint: 10,
        guidance: "hold",
      });
    }

    return NextResponse.json({ success: true, holding: newHolding });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Holding ID is required" }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
