import yahooFinance from "yahoo-finance2";
import { tavily } from "@tavily/core";
import { AgentState, PricePoint, NewsArticle, Fundamentals } from "../state";

// Initialize Tavily Client
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

export async function gatherDataNode(state: typeof AgentState.State) {
  const ticker = state.ticker;
  const companyName = state.companyName;
  const logs: string[] = [];

  logs.push(`Gathering price history, fundamentals, and recent news for ${ticker}...`);

  // Calculate dates for 1 year of price history
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  let priceHistory: PricePoint[] = [];
  const fundamentals: Fundamentals = {
    peRatio: "unavailable",
    peSectorRatio: "unavailable",
    marketCap: "unavailable",
    fiftyTwoWeekHigh: "unavailable",
    fiftyTwoWeekLow: "unavailable",
    promoterHolding: "unavailable",
    promoterHoldingChange: "unavailable",
    debtToEquity: "unavailable",
  };
  let newsArticles: NewsArticle[] = [];
  let sectorContext = "Sector data unavailable";

  // 1. Fetch Price History
  try {
    const historyResult = await yahooFinance.historical(ticker, {
      period1: oneYearAgo.toISOString().split("T")[0],
      period2: today.toISOString().split("T")[0],
      interval: "1d",
    });

    if (Array.isArray(historyResult)) {
      priceHistory = (historyResult as any)
        .map((p: any) => ({
          date: p.date ? new Date(p.date).toISOString().split("T")[0] : "",
          close: p.close || p.adjClose || 0,
        }))
        .filter((p: any) => p.date && p.close > 0);
      logs.push(`Fetched ${priceHistory.length} price points for 1Y history.`);
    }
  } catch (error: any) {
    logs.push(`Warning: Failed to fetch price history: ${error.message || error}`);
  }

  // 2. Fetch Fundamentals from Yahoo Finance quoteSummary
  try {
    const summary = (await yahooFinance.quoteSummary(ticker, {
      modules: [
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "majorHoldersBreakdown",
        "price",
      ],
    })) as any;

    if (summary) {
      // Market Cap
      if (summary.summaryDetail?.marketCap) {
        fundamentals.marketCap = summary.summaryDetail.marketCap;
      }
      
      // PE Ratio
      if (summary.summaryDetail?.trailingPE) {
        fundamentals.peRatio = summary.summaryDetail.trailingPE;
      } else if (summary.summaryDetail?.forwardPE) {
        fundamentals.peRatio = summary.summaryDetail.forwardPE;
      }

      // 52W High / Low
      if (summary.summaryDetail?.fiftyTwoWeekHigh) {
        fundamentals.fiftyTwoWeekHigh = summary.summaryDetail.fiftyTwoWeekHigh;
      }
      if (summary.summaryDetail?.fiftyTwoWeekLow) {
        fundamentals.fiftyTwoWeekLow = summary.summaryDetail.fiftyTwoWeekLow;
      }

      // Debt to Equity
      if (summary.financialData?.debtToEquity) {
        // Yahoo Finance sometimes returns D/E as percentage (e.g. 42 for 0.42) or decimal.
        const de = summary.financialData.debtToEquity;
        fundamentals.debtToEquity = de > 5 ? de / 100 : de; // normalize if > 5 (likely percentage)
      }

      // Promoter holdings
      // Try majorHoldersBreakdown -> insidersPercent
      if (summary.majorHoldersBreakdown?.insidersPercent) {
        fundamentals.promoterHolding = summary.majorHoldersBreakdown.insidersPercent * 100;
      } else if (summary.defaultKeyStatistics?.heldPercentInsiders) {
        fundamentals.promoterHolding = summary.defaultKeyStatistics.heldPercentInsiders * 100;
      }
      
      logs.push(`Fetched basic financial data from Yahoo Finance.`);
    }
  } catch (error: any) {
    logs.push(`Warning: Failed to fetch fundamentals from Yahoo Finance: ${error.message || error}`);
  }

  // 3. Parallel web search using Tavily for recent news, sector PE, promoter holding trend
  try {
    const queries = [
      `"${companyName}" OR "${ticker}" recent news financial analysis 2026`,
      `"${companyName}" OR "${ticker}" average sector PE ratio Indian stock market`,
      `"${companyName}" OR "${ticker}" promoter shareholding holding trend increase decrease`,
    ];

    const searchPromises = queries.map((q) =>
      tvly.search(q, {
        searchDepth: "basic",
        maxResults: 6,
      })
    );

    const [newsResults, sectorResults, shareholdingResults] = await Promise.all(searchPromises);

    // Parse News
    if (newsResults && newsResults.results) {
      newsArticles = newsResults.results.map((r: any) => ({
        title: r.title || "News Article",
        url: r.url || "",
        content: r.content || "",
      }));
      logs.push(`Fetched ${newsArticles.length} recent news/analysis articles via Tavily.`);
    }

    // Try to extract Sector P/E from Tavily results if unavailable from Yahoo Finance
    const sectorContentText = sectorResults.results?.map((r: any) => r.content).join("\n") || "";
    sectorContext = sectorContentText;
    
    // Parse promoter shareholding info if not fetched by Yahoo Finance
    const holdingContentText = shareholdingResults.results?.map((r: any) => r.content).join("\n") || "";

    // Fallback extraction through simple heuristics (LLM in next nodes will do heavy extraction,
    // but let's see if we can identify changes in promoter holding trend).
    // We will save these texts in the state so build_thesis can extract them accurately.
    logs.push(`Fetched sector and shareholding context via Tavily.`);

  } catch (error: any) {
    logs.push(`Warning: Failed web search via Tavily: ${error.message || error}`);
  }

  return {
    priceHistory,
    fundamentals,
    newsArticles,
    sectorContext,
    logs,
  };
}
