import { z } from "zod";
import { AgentState, FinalMemo } from "../state";
import { callLlmStructured } from "../llm";

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

const cleanText = (text: string) => {
  return text
    .replace(/\*\*+/g, "")
    .replace(/\*+/g, "")
    .replace(/#+/g, "")
    .replace(/`/g, "")
    .trim();
};

function formatMarketCap(mc: any): string {
  if (!mc || mc === "unavailable") return "unavailable";
  const num = Number(mc);
  if (isNaN(num)) return String(mc);
  if (num >= 1e12) return `₹${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(2)}L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatPercentage(p: any): string {
  if (!p || p === "unavailable") return "unavailable";
  const num = Number(p);
  if (isNaN(num)) return String(p);
  return `${num.toFixed(2)}%`;
}

function formatDecimal(d: any): string {
  if (!d || d === "unavailable") return "unavailable";
  const num = Number(d);
  if (isNaN(num)) return String(d);
  return num.toFixed(2);
}

export async function writeMemoNode(state: typeof AgentState.State) {
  const logs: string[] = [];
  logs.push(`Assembling final investment memo and formatting key metrics...`);

  // Format numerical stats to feed into the model
  const rawPe = state.fundamentals.peRatio;
  const rawMarketCap = state.fundamentals.marketCap;
  const rawPromoter = state.fundamentals.promoterHolding;
  const rawDe = state.fundamentals.debtToEquity;

  const currencySymbol = state.fundamentals.currencySymbol || "₹";

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

  const formattedCurrentPrice = state.fundamentals.currentPrice !== undefined && state.fundamentals.currentPrice !== "unavailable"
    ? `${currencySymbol}${Number(state.fundamentals.currentPrice).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "unavailable";

  try {
    const result = await callLlmStructured(systemPrompt, userPrompt, memoSchema, 0.1);

    const data = result.data;
    const cleanedSummary = cleanText(data.summary);
    const cleanedThesisPoints = (data.thesisPoints || []).map(cleanText);
    const cleanedKeyRisks = (data.keyRisks || []).map(cleanText);

    // Apply strict cleanups on result KPIs
    const cleanedKpis = {
      peRatio: cleanText(data.kpis.peRatio),
      peSectorRatio: cleanText(data.kpis.peSectorRatio),
      marketCap: cleanText(data.kpis.marketCap),
      fiftyTwoWeekHigh: cleanText(data.kpis.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: cleanText(data.kpis.fiftyTwoWeekLow),
      promoterHolding: cleanText(data.kpis.promoterHolding),
      debtToEquity: cleanText(data.kpis.debtToEquity),
      currentPrice: formattedCurrentPrice,
    };

    const finalMemo: FinalMemo = {
      verdict: state.verdict,
      confidence: state.confidence,
      ticker: state.ticker,
      companyName: state.companyName,
      investorProfile: state.investorProfile,
      summary: cleanedSummary,
      thesisPoints: cleanedThesisPoints,
      keyRisks: cleanedKeyRisks,
      kpis: cleanedKpis,
      killCriteria: state.killCriteria,
      priceData: state.priceHistory.slice(-30), // send latest 30 points to keep visual payload clean
    };

    return {
      memo: finalMemo,
      logs: logs.concat([`Final memo generated and stored (${result.source}).`]),
    };
  } catch (error: any) {
    logs.push(`Error in write_memo: ${error.message || error}`);
    
    // Parse thesis sentences for bullet points in case of fallback
    let fallbackThesisPoints = [state.thesis || "Core business shows resilience."];
    if (state.thesis) {
      const lines = state.thesis
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.startsWith("*") || line.startsWith("-") || /^\d+\./.test(line))
        .map(line => line.replace(/^[\*\-\d\.\s]+/, "").trim())
        .map(cleanText)
        .filter(Boolean);
      if (lines.length >= 3) {
        fallbackThesisPoints = lines.slice(0, 5);
      } else {
        const sentences = state.thesis
          .split(/[.!?]+/)
          .map(s => s.trim())
          .map(cleanText)
          .filter(s => s.length > 20);
        if (sentences.length >= 3) {
          fallbackThesisPoints = sentences.slice(0, 4);
        }
      }
    }

    const fmtHigh = state.fundamentals.fiftyTwoWeekHigh !== "unavailable"
      ? `${currencySymbol}${Number(state.fundamentals.fiftyTwoWeekHigh).toLocaleString("en-IN")}`
      : "unavailable";
    const fmtLow = state.fundamentals.fiftyTwoWeekLow !== "unavailable"
      ? `${currencySymbol}${Number(state.fundamentals.fiftyTwoWeekLow).toLocaleString("en-IN")}`
      : "unavailable";

    const fallbackMemo: FinalMemo = {
      verdict: state.verdict || "Pass",
      confidence: state.confidence || 50,
      ticker: state.ticker || "UNKNOWN",
      companyName: state.companyName || "Unknown",
      investorProfile: state.investorProfile || "aggressive",
      summary: "Investment analysis complete. Final recommendation: " + (state.verdict || "Pass"),
      thesisPoints: fallbackThesisPoints,
      keyRisks: ["Market volatility", "Regulatory changes"],
      kpis: {
        peRatio: formatDecimal(rawPe),
        peSectorRatio: "unavailable",
        marketCap: formatMarketCap(rawMarketCap),
        fiftyTwoWeekHigh: fmtHigh,
        fiftyTwoWeekLow: fmtLow,
        promoterHolding: formatPercentage(rawPromoter),
        debtToEquity: formatDecimal(rawDe),
        currentPrice: formattedCurrentPrice,
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
