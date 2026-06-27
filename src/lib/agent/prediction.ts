import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });
import { tavily } from "@tavily/core";
import { z } from "zod";
import { callLlmStructured } from "./llm";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

// Zod schema for sentiment response
const sentimentSchema = z.object({
  score: z.number().min(-1).max(1).describe("The overall sentiment score from -1.0 (extremely negative/bearish) to +1.0 (extremely positive/bullish)"),
  explanation: z.string().describe("A brief 1-sentence explanation of the sentiment assessment.")
});

export async function calculateHoldingPrediction(ticker: string, companyName: string) {
  let score = 0;
  let rangeLow = 5;
  let rangeHigh = 15;
  let midpoint = 10;
  let guidance: "hold" | "reconsider" | "reduce" = "hold";
  let logs = "";

  try {
    // 1. Fetch 1Y price history for trend calculation
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    let annualTrend = 0.1; // default +10% trend
    try {
      const history = (await yahooFinance.historical(ticker, {
        period1: oneYearAgo.toISOString().split("T")[0],
        period2: today.toISOString().split("T")[0],
        interval: "1wk", // use weekly for speed
      })) as any;

      if (Array.isArray(history) && history.length > 5) {
        // Linear regression trend extrapolation
        const closes = (history as any).map((h: any) => h.close).filter((c: any) => c && c > 0);
        if (closes.length > 2) {
          const firstPrice = closes[0];
          const lastPrice = closes[closes.length - 1];
          // Annualized return (change over 1Y)
          annualTrend = (lastPrice - firstPrice) / firstPrice;
          
          // Clip trend to reasonable bounds [-30%, +30%]
          annualTrend = Math.max(-0.3, Math.min(0.3, annualTrend));
        }
      }
    } catch (e: any) {
      logs += `Trend calc warning: ${e.message || e}. Using default +10%. `;
    }

    // 2. Fetch recent news (~20 articles) via Tavily
    let newsContext = "";
    try {
      const query = `"${companyName}" OR "${ticker}" latest news updates 2026`;
      const searchResult = await tvly.search(query, {
        searchDepth: "basic",
        maxResults: 15, // Tavily returns high-quality results
      });

      newsContext = searchResult.results
        ?.map((r: any) => `Title: ${r.title}\nContent: ${r.content}`)
        .join("\n\n") || "";
    } catch (e: any) {
      logs += `Tavily news warning: ${e.message || e}. Using neutral sentiment. `;
    }

    // 3. Score news sentiment using our fallback LLM layer
    let sentimentVal = 0;
    if (newsContext) {
      try {
        const systemPrompt = "You are a quantitative financial sentiment analyzer. Grade the following recent news for a company.";
        const userPrompt = `Analyze the news articles for ${companyName} (${ticker}) and return the net sentiment score (-1 to +1):\n\n${newsContext}`;
        
        const response = await callLlmStructured(systemPrompt, userPrompt, sentimentSchema, 0.1);
        sentimentVal = response.data.score;
        logs += `LLM (${response.source}) scored sentiment: ${sentimentVal.toFixed(2)} (${response.data.explanation}). `;
      } catch (e: any) {
        logs += `LLM sentiment warning: ${e.message || e}. `;
      }
    }

    // 4. Combine trend & sentiment
    // Let trend be weighted at 60%, sentiment at 40%
    // Sentiment adjustment adds or subtracts up to 15% (e.g. sentimentVal * 0.15)
    const sentimentAdjustment = sentimentVal * 0.15;
    const computedMidpoint = annualTrend + sentimentAdjustment;

    // Convert to percentages
    midpoint = Math.round(computedMidpoint * 100);
    // Add a range buffer of 7% on each side
    rangeLow = midpoint - 7;
    rangeHigh = midpoint + 7;
    score = Number(sentimentVal.toFixed(2));

    // 5. Select guidance
    if (midpoint > 5) {
      guidance = "hold";
    } else if (midpoint >= -5) {
      guidance = "reconsider";
    } else {
      guidance = "reduce";
    }

  } catch (error: any) {
    logs += `Overall error: ${error.message || error}. Falling back to default.`;
  }

  return {
    score,
    rangeLow,
    rangeHigh,
    midpoint,
    guidance,
    logs: logs || "Calculation complete with defaults."
  };
}
