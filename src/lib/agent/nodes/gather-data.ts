import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });
import { tavily } from "@tavily/core";
import { AgentState, PricePoint, NewsArticle, Fundamentals } from "../state";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

export async function gatherDataNode(state: typeof AgentState.State) {
  const ticker = state.ticker;
  const companyName = state.companyName;
  const logs: string[] = [];

  logs.push(`Gathering price history, fundamentals, and web news for ${ticker}...`);

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
  let challengeEvidence = "Bearish risk data unavailable";

  // 1. Fetch Price History & Fundamentals from Yahoo Finance
  try {
    let historyResult: any = null;
    let summary: any = null;

    await Promise.all([
      (async () => {
        try {
          historyResult = await yahooFinance.historical(ticker, {
            period1: oneYearAgo.toISOString().split("T")[0],
            period2: today.toISOString().split("T")[0],
            interval: "1d",
          });
        } catch (err: any) {
          logs.push(`Warning: Failed price history fetch: ${err.message}`);
        }
      })(),
      (async () => {
        try {
          summary = await yahooFinance.quoteSummary(ticker, {
            modules: [
              "summaryDetail",
              "financialData",
              "defaultKeyStatistics",
              "majorHoldersBreakdown",
              "price",
            ],
          });
        } catch (err: any) {
          logs.push(`Warning: Failed quoteSummary fetch: ${err.message}`);
        }
      })()
    ]);

    // Parse History
    if (Array.isArray(historyResult)) {
      priceHistory = (historyResult as any)
        .map((p: any) => ({
          date: p.date ? new Date(p.date).toISOString().split("T")[0] : "",
          close: p.close || p.adjClose || 0,
        }))
        .filter((p: any) => p.date && p.close > 0);
      logs.push(`Fetched ${priceHistory.length} price points for 1Y history.`);
    }

    // Parse Fundamentals
    if (summary) {
      const s = summary as any;
      if (s.summaryDetail?.marketCap) fundamentals.marketCap = s.summaryDetail.marketCap;
      if (s.summaryDetail?.trailingPE) fundamentals.peRatio = s.summaryDetail.trailingPE;
      else if (s.summaryDetail?.forwardPE) fundamentals.peRatio = s.summaryDetail.forwardPE;
      if (s.summaryDetail?.fiftyTwoWeekHigh) fundamentals.fiftyTwoWeekHigh = s.summaryDetail.fiftyTwoWeekHigh;
      if (s.summaryDetail?.fiftyTwoWeekLow) fundamentals.fiftyTwoWeekLow = s.summaryDetail.fiftyTwoWeekLow;
      
      if (s.financialData?.debtToEquity) {
        const de = s.financialData.debtToEquity;
        fundamentals.debtToEquity = de > 5 ? de / 100 : de;
      }

      if (s.majorHoldersBreakdown?.insidersPercent) {
        fundamentals.promoterHolding = s.majorHoldersBreakdown.insidersPercent * 100;
      } else if (s.defaultKeyStatistics?.heldPercentInsiders) {
        fundamentals.promoterHolding = s.defaultKeyStatistics.heldPercentInsiders * 100;
      }

      // Extract current price and currency symbol
      if (s.price) {
        fundamentals.currentPrice = s.price.regularMarketPrice || s.financialData?.currentPrice || "unavailable";
        fundamentals.currencySymbol = s.price.currencySymbol || (ticker.endsWith(".NS") || ticker.endsWith(".BO") ? "₹" : "$");
      } else if (s.financialData?.currentPrice) {
        fundamentals.currentPrice = s.financialData.currentPrice;
        fundamentals.currencySymbol = ticker.endsWith(".NS") || ticker.endsWith(".BO") ? "₹" : "$";
      } else {
        fundamentals.currentPrice = "unavailable";
        fundamentals.currencySymbol = ticker.endsWith(".NS") || ticker.endsWith(".BO") ? "₹" : "$";
      }

      logs.push(`Yahoo Finance financial metrics loaded. Live Price: ${fundamentals.currencySymbol}${fundamentals.currentPrice}`);
    }
  } catch (error: any) {
    logs.push(`Warning: Failed fetching fundamentals: ${error.message || error}`);
  }

  // 2. Parallel Web Search using Tavily for News, Sector averages, and Bearish risks
  try {
    const isIndian = ticker.endsWith(".NS") || ticker.endsWith(".BO");
    const marketIndicator = isIndian ? "Indian stock market" : "global stock market";

    const queries = [
      `"${companyName}" OR "${ticker}" news updates financials 2026`,
      `"${companyName}" OR "${ticker}" sector PE ratio average ${marketIndicator}`,
      `"${companyName}" OR "${ticker}" risks problems critiques bearish negatives 2026`,
    ];

    logs.push("Running parallel news, sector context, and risk searches via Tavily...");

    const searchPromises = queries.map((q) =>
      tvly.search(q, {
        searchDepth: "basic", // Basic search is much faster than advanced (2s vs 8s)
        maxResults: 5,
      })
    );

    const [newsResults, sectorResults, bearResults] = await Promise.all(searchPromises);

    // Parse News
    if (newsResults?.results) {
      newsArticles = newsResults.results.map((r: any) => ({
        title: r.title || "News Article",
        url: r.url || "",
        content: r.content || "",
      }));
    }

    // Parse Sector PE
    if (sectorResults?.results) {
      sectorContext = sectorResults.results.map((r: any) => r.content).join("\n");
    }

    // Parse Bearish Risks
    if (bearResults?.results) {
      challengeEvidence = bearResults.results
        .map((r: any) => `Title: ${r.title}\nContent: ${r.content}\nURL: ${r.url}`)
        .join("\n\n");
    }

    logs.push(`Tavily web research completed successfully.`);
  } catch (error: any) {
    logs.push(`Warning: Failed Tavily search: ${error.message || error}`);
  }

  return {
    priceHistory,
    fundamentals,
    newsArticles,
    sectorContext,
    challengeEvidence,
    logs,
  };
}
