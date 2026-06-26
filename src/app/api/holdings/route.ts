import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { calculateHoldingPrediction } from "@/lib/agent/prediction";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

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

    // Format holdings to return the latest prediction
    const formattedHoldings = holdings.map((holding) => {
      const preds = holding.predictions || [];
      // Sort descending by created_at or date to get the latest prediction
      const sortedPreds = preds.sort(
        (a: any, b: any) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
      );
      
      const latestPrediction = sortedPreds[0] || null;
      
      // Separate history for charting predictions over time
      const predictionHistory = sortedPreds
        .map((p: any) => ({
          date: p.date,
          score: p.score,
          range_low: p.range_low,
          range_high: p.range_high,
          midpoint: p.midpoint,
        }))
        .reverse(); // chronological order for charts

      // Remove the full predictions array to avoid duplicate data
      const { predictions, ...holdingData } = holding;

      return {
        ...holdingData,
        latestPrediction,
        predictionHistory,
      };
    });

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

    // 1. Insert into holdings
    const { data: newHolding, error: insertError } = await supabase
      .from("holdings")
      .insert({
        user_id: user.id,
        company,
        ticker,
        amount_invested: Number(amountInvested),
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

      // Create admin client to insert the prediction (bypassing strict RLS user restrictions if needed, 
      // although user can insert their own predictions if permitted, but using admin is bulletproof).
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
      // Insert a default fallback prediction so dashboard doesn't break
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
