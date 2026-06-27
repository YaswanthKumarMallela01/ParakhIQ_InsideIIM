import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { synthesizeVerdictNode } from "@/lib/agent/nodes/synthesize-verdict";
import { writeMemoNode } from "@/lib/agent/nodes/write-memo";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { profile } = await request.json();

    if (profile !== "conservative" && profile !== "aggressive") {
      return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
    }

    const adminSupabase = createSupabaseAdmin();

    // Load the existing research run
    const { data: run, error: fetchError } = await adminSupabase
      .from("research_history")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !run) {
      return NextResponse.json({ error: "Research not found" }, { status: 404 });
    }

    const existingVerdicts = run.verdicts || {};
    
    // Check if the profile is already cached in verdicts JSONB
    if (existingVerdicts[profile]) {
      return NextResponse.json({ memo: existingVerdicts[profile] });
    }

    const originalMemo = run.memo;

    // Reconstruct a partial AgentState for the node functions
    // We map the stored memo back into the required state fields
    const mockState: any = {
      companyName: run.company_name,
      ticker: run.ticker,
      investorProfile: profile,
      fundamentals: {
        peRatio: originalMemo.kpis.peRatio,
        peSectorRatio: originalMemo.kpis.peSectorRatio,
        marketCap: originalMemo.kpis.marketCap,
        fiftyTwoWeekHigh: originalMemo.kpis.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: originalMemo.kpis.fiftyTwoWeekLow,
        promoterHolding: originalMemo.kpis.promoterHolding,
        debtToEquity: originalMemo.kpis.debtToEquity,
        currentPrice: originalMemo.kpis.currentPrice,
      },
      thesis: originalMemo.thesisPoints.map((p: string) => `- ${p}`).join("\n"),
      challengeHistory: [
        {
          loopIndex: 0,
          evidence: "Key risks: " + originalMemo.keyRisks.join(", "),
          reviewResult: "Evaluate based on new profile constraints.",
        },
      ],
      priceHistory: originalMemo.priceData || [],
      sectorContext: "Previously evaluated sector data.",
    };

    // Run synthesize verdict
    const verdictResult = await synthesizeVerdictNode(mockState);
    
    mockState.verdict = verdictResult.verdict;
    mockState.confidence = verdictResult.confidence;
    mockState.reasoning = verdictResult.reasoning;
    mockState.killCriteria = verdictResult.killCriteria;

    // Run write memo
    const memoResult = await writeMemoNode(mockState);
    const newMemo = memoResult.memo;

    // Save to database
    existingVerdicts[profile] = newMemo;

    // Update the verdicts column. We also update the main verdict, confidence, and memo if we want
    // the UI to show the latest as the default, but it's safer just to add to verdicts map.
    const { error: updateError } = await adminSupabase
      .from("research_history")
      .update({ verdicts: existingVerdicts })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update verdicts cache:", updateError);
    }

    return NextResponse.json({ memo: newMemo });

  } catch (error: any) {
    console.error("Error in reverdict:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
