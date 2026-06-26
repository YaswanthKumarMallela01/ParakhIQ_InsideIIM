import { NextRequest } from "next/server";
import { runResearchAgent } from "@/lib/agent/graph";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { companyName, investorProfile } = await request.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: "Company name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const agentStream = await runResearchAgent(companyName, investorProfile);

          for await (const chunk of agentStream) {
            // chunk contains updates from the node that just executed
            const nodeName = Object.keys(chunk)[0];
            const nodeData = (chunk as any)[nodeName];

            sendEvent("update", {
              node: nodeName,
              logs: nodeData.logs || [],
              thesis: nodeData.thesis,
              verdict: nodeData.verdict,
              confidence: nodeData.confidence,
              killCriteria: nodeData.killCriteria,
              memo: nodeData.memo,
              ticker: nodeData.ticker,
              exchange: nodeData.exchange,
            });
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
