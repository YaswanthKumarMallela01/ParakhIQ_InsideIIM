import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: holdings, error } = await supabase
      .from("holdings")
      .select(`
        *,
        predictions (*)
      `)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        totalInvested: 0,
        sectorAllocation: [],
        weightedPredictedRange: { low: 0, high: 0, midpoint: 0 },
        holdingsNeedingAttention: 0,
        concentrationWarnings: [],
      });
    }

    let totalInvested = 0;
    const sectorMap: Record<string, number> = {};
    let weightedLowSum = 0;
    let weightedHighSum = 0;
    let weightedMidpointSum = 0;
    let holdingsNeedingAttention = 0;

    holdings.forEach((holding: any) => {
      const invested = Number(holding.amount_invested) || 0;
      totalInvested += invested;

      const sector = holding.sector || "Uncategorized";
      sectorMap[sector] = (sectorMap[sector] || 0) + invested;

      let prediction = null;
      if (holding.predictions && holding.predictions.length > 0) {
        prediction = holding.predictions.sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
      }

      if (prediction) {
        weightedLowSum += (prediction.range_low || 0) * invested;
        weightedHighSum += (prediction.range_high || 0) * invested;
        weightedMidpointSum += (prediction.midpoint || 0) * invested;

        if (prediction.guidance === "reconsider" || prediction.guidance === "reduce") {
          holdingsNeedingAttention++;
        }
      }
    });

    const sectorAllocation = Object.keys(sectorMap).map((sector) => ({
      name: sector,
      value: sectorMap[sector],
      percent: totalInvested > 0 ? (sectorMap[sector] / totalInvested) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    const concentrationWarnings: string[] = [];
    if (sectorAllocation.length > 0 && sectorAllocation[0].percent > 40) {
      concentrationWarnings.push(`>40% of portfolio concentrated in ${sectorAllocation[0].name} sector`);
    }
    
    if (holdingsNeedingAttention > 1) {
      concentrationWarnings.push(`${holdingsNeedingAttention} holdings have been flagged to reconsider or reduce`);
    }

    const weightedPredictedRange = totalInvested > 0
      ? {
          low: parseFloat((weightedLowSum / totalInvested).toFixed(2)),
          high: parseFloat((weightedHighSum / totalInvested).toFixed(2)),
          midpoint: parseFloat((weightedMidpointSum / totalInvested).toFixed(2)),
        }
      : { low: 0, high: 0, midpoint: 0 };

    return NextResponse.json({
      totalInvested,
      sectorAllocation,
      weightedPredictedRange,
      holdingsNeedingAttention,
      concentrationWarnings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
