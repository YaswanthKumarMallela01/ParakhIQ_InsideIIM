import { NextRequest } from "next/server";
import { runResearchAgent } from "@/lib/agent/graph";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveTickerNode } from "@/lib/agent/nodes/resolve-ticker";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { companyName, investorProfile } = await request.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: "Company name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createSupabaseAdmin();

    // Resolve the ticker first using our node logic to check cache
    const resolveResult = await resolveTickerNode({ companyName } as any);
    const resolvedTicker = resolveResult.ticker;
    const resolvedExchange = resolveResult.exchange;

    // Check if we have a cached research run from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cachedRun } = await adminSupabase
      .from("research_history")
      .select("*")
      .eq("ticker", resolvedTicker)
      .eq("memo->>investorProfile", investorProfile)
      .gt("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          if (cachedRun) {
            console.log(`[CACHE HIT] Found recent research for ${resolvedTicker}`);
            
            // Stream mock log steps in 1.5 seconds to simulate loading but load instantly
            sendEvent("update", { node: "intake", logs: [`Parsed company: ${companyName}. Profile: ${investorProfile.toUpperCase()}`, "Found cached research in terminal memory. Loading instantly..."] });
            await sleep(250);
            sendEvent("update", { node: "resolve_ticker", logs: [`Resolved ticker directly to ${resolvedTicker} (${resolvedExchange}) from cache.`] });
            await sleep(250);
            sendEvent("update", { node: "gather_data", logs: ["Loaded fundamentals and price history from cache."] });
            await sleep(250);
            sendEvent("update", { node: "build_thesis", logs: ["Thesis loaded from cache."] });
            await sleep(200);
            sendEvent("update", { node: "challenge_thesis", logs: ["Critique history loaded from cache."] });
            await sleep(150);
            sendEvent("update", { node: "synthesize_verdict", logs: [`Verdict retrieved: ${cachedRun.verdict.toUpperCase()}`] });
            await sleep(150);
            sendEvent("update", {
              node: "write_memo",
              logs: ["Final memo retrieved from database."],
              memo: cachedRun.memo,
              ticker: resolvedTicker,
              exchange: resolvedExchange,
            });
            await sleep(100);
            sendEvent("done", { success: true });
            controller.close();
            return;
          }

          // Cache miss: Run the optimized agent graph
          const agentStream = await runResearchAgent(companyName, investorProfile);
          let finalMemo: any = null;
          let finalVerdict = "Pass";
          let finalConfidence = 50;

          for await (const chunk of agentStream) {
            const nodeName = Object.keys(chunk)[0];
            const nodeData = (chunk as any)[nodeName];

            if (nodeData.memo) {
              finalMemo = nodeData.memo;
            }
            if (nodeData.verdict) {
              finalVerdict = nodeData.verdict;
            }
            if (nodeData.confidence) {
              finalConfidence = nodeData.confidence;
            }

            sendEvent("update", {
              node: nodeName,
              logs: nodeData.logs || [],
              thesis: nodeData.thesis,
              verdict: nodeData.verdict,
              confidence: nodeData.confidence,
              killCriteria: nodeData.killCriteria,
              memo: nodeData.memo,
              ticker: nodeData.ticker || resolvedTicker,
              exchange: nodeData.exchange || resolvedExchange,
            });
          }

          // Save completed research run to database cache
          if (finalMemo) {
            const { error: saveError } = await adminSupabase.from("research_history").insert({
              user_id: user.id,
              company_name: finalMemo.companyName || companyName,
              ticker: resolvedTicker,
              verdict: finalVerdict,
              confidence: Number(finalConfidence),
              memo: finalMemo,
            });
            if (saveError) {
              console.error("Failed to save research to cache:", saveError);
            }
          }

          sendEvent("done", { success: true });
          controller.close();
        } catch (error: any) {
          sendEvent("error", { error: error.message || error });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
