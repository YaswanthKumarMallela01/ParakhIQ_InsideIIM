import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { AgentState, FinalMemo } from "../state";

const memoSchema = z.object({
  summary: z.string().describe("A concise, dense, executive summary (2-3 sentences) of the investment decision."),
  thesisPoints: z.array(z.string()).min(3).max(5).describe("3-5 core bullet points of the investment thesis, supported by numerical data where possible."),
  keyRisks: z.array(z.string()).min(3).max(5).describe("3-5 key operational, financial, or market risks associated with the holding."),
  kpis: z.object({
    peRatio: z.string().describe("Company P/E ratio, e.g. '28.5' or 'unavailable'"),
    peSectorRatio: z.string().describe("Sector P/E ratio, e.g. '24.1' or 'unavailable'"),
    marketCap: z.string().describe("Market Cap formatted with Indian numbering, e.g. '₹19.2L Cr' or '₹52,000 Cr' or 'unavailable'"),
    fiftyTwoWeekHigh: z.string().describe("52W High formatted, e.g. '₹3,024.90' or 'unavailable'"),
    fiftyTwoWeekLow: z.string().describe("52W Low formatted, e.g. '₹2,220.30' or 'unavailable'"),
    promoterHolding: z.string().describe("Promoter shareholding with QoQ trend if found, e.g. '50.49% (↑ 0.12% QoQ)' or '50.49%' or 'unavailable'"),
    debtToEquity: z.string().describe("Debt-to-equity ratio, e.g. '0.42' or 'unavailable'"),
  }),
});

export async function writeMemoNode(state: typeof AgentState.State) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    temperature: 0.1,
  });

  const logs: string[] = [];
  logs.push(`Assembling final investment memo and formatting key metrics...`);

  // Format numerical stats to feed into the model
  const rawPe = state.fundamentals.peRatio;
  const rawMarketCap = state.fundamentals.marketCap;
  const rawPromoter = state.fundamentals.promoterHolding;
  const rawDe = state.fundamentals.debtToEquity;

  const systemPrompt = `You are a Senior Equity Editor at ParakhIQ. Your job is to format the final investment analysis into a dense, terminal-style structured memo. You must extract and format the key financials accurately based on the data.`;

  const userPrompt = `
COMPANY: ${state.companyName} (${state.ticker})
INVESTOR PROFILE: ${state.investorProfile.toUpperCase()}
VERDICT: ${state.verdict}
CONFIDENCE: ${state.confidence}%
REASONING SUMMARY: ${state.reasoning}

--- RAW FINANCIALS ---
- P/E Ratio: ${rawPe}
- Market Cap: ${rawMarketCap}
- 52W High: ${state.fundamentals.fiftyTwoWeekHigh}
- 52W Low: ${state.fundamentals.fiftyTwoWeekLow}
- Debt/Equity: ${rawDe}
- Promoter Holding: ${rawPromoter}

--- SEARCH CONTEXT FOR SECTOR AND TRENDS ---
${state.sectorContext}

--- FINAL THESIS & RISKS ---
${state.thesis}

Your task:
1. Synthesize the final thesis and risks into structured bullet points.
2. Format the KPIs correctly. Convert Market Cap from raw bytes/numbers into Indian formats like "L Cr" or "Cr" (e.g. 19200000000000 -> "₹19.2L Cr").
3. Search the context for "sector P/E" and promoter shareholding trend details. If you find a trend (e.g. increase/decrease by X%), format it as 'X% (↑ Y% QoQ)'. If no trend or sector PE is found in the search context, mark it as 'unavailable'.
4. Write a concise executive summary.
`;

  try {
    const structuredModel = model.withStructuredOutput(memoSchema);
    const result = await structuredModel.invoke([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]);

    const finalMemo: FinalMemo = {
      verdict: state.verdict,
      confidence: state.confidence,
      ticker: state.ticker,
      companyName: state.companyName,
      investorProfile: state.investorProfile,
      summary: result.summary,
      thesisPoints: result.thesisPoints,
      keyRisks: result.keyRisks,
      kpis: result.kpis,
      killCriteria: state.killCriteria,
      priceData: state.priceHistory.slice(-30), // send latest 30 points to keep visual payload clean
    };

    return {
      memo: finalMemo,
      logs: logs.concat([`Final memo generated and stored.`]),
    };
  } catch (error: any) {
    logs.push(`Error in write_memo: ${error.message || error}`);
    
    // Fallback memo
    const fallbackMemo: FinalMemo = {
      verdict: state.verdict || "Pass",
      confidence: state.confidence || 50,
      ticker: state.ticker || "UNKNOWN",
      companyName: state.companyName || "Unknown",
      investorProfile: state.investorProfile || "aggressive",
      summary: "Investment analysis complete. Final recommendation: " + (state.verdict || "Pass"),
      thesisPoints: [state.thesis || "Core business shows resilience."],
      keyRisks: ["Market volatility", "Regulatory changes"],
      kpis: {
        peRatio: String(rawPe),
        peSectorRatio: "unavailable",
        marketCap: String(rawMarketCap),
        fiftyTwoWeekHigh: String(state.fundamentals.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: String(state.fundamentals.fiftyTwoWeekLow),
        promoterHolding: String(rawPromoter),
        debtToEquity: String(rawDe),
      },
      killCriteria: state.killCriteria || [],
      priceData: state.priceHistory.slice(-30),
    };

    return {
      memo: fallbackMemo,
      logs,
    };
  }
}
