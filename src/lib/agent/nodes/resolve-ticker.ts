import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });
import { AgentState } from "../state";

export async function resolveTickerNode(state: typeof AgentState.State) {
  const query = state.companyName.trim();
  let resolvedTicker = "";
  let resolvedExchange = "";
  let logs: string[] = [];

  logs.push(`Resolving stock symbol for "${query}"...`);

  // 1. Check if the query itself is a valid direct ticker (e.g. "NVDA", "RELIANCE.NS", "AAPL")
  const potentialTicker = query.toUpperCase().replace(/\s+/g, "");
  const isDirectTickerCandidate = query.includes(".") || query.length <= 5;
  
  if (isDirectTickerCandidate) {
    try {
      const directQuote = (await yahooFinance.quote(potentialTicker)) as any;
      if (directQuote && directQuote.symbol) {
        resolvedTicker = directQuote.symbol;
        resolvedExchange = directQuote.exchange || (resolvedTicker.endsWith(".NS") ? "NSE" : resolvedTicker.endsWith(".BO") ? "BSE" : "GLOBAL");
        logs.push(`Symbol "${resolvedTicker}" validated directly on ${resolvedExchange}.`);
        return {
          ticker: resolvedTicker,
          exchange: resolvedExchange,
          logs,
        };
      }
    } catch (e) {
      // Not a direct ticker, continue to search resolution
    }
  }

  // 2. Search Yahoo Finance for matching equity
  try {
    const searchResults = (await yahooFinance.search(query, { lang: "en-US" })) as any;
    const quotes = searchResults.quotes || [];

    if (quotes.length > 0) {
      // Find the first equity match (ignore currency, funds, etc.)
      const equityQuotes = quotes.filter((q: any) => q.quoteType === "EQUITY");

      if (equityQuotes.length > 0) {
        // Try to prioritize Indian stocks (.NS or .BO)
        const indianQuote = equityQuotes.find(
          (q: any) =>
            q.symbol?.endsWith(".NS") ||
            q.symbol?.endsWith(".BO") ||
            q.exchange === "NSI" ||
            q.exchange === "BOM"
        );

        if (indianQuote) {
          resolvedTicker = indianQuote.symbol;
          resolvedExchange = indianQuote.exchange || (resolvedTicker.endsWith(".NS") ? "NSE" : "BSE");
          logs.push(`Resolved search to Indian equity: ${resolvedTicker} (${resolvedExchange})`);
        } else {
          // Fall back to first global equity quote
          const globalQuote = equityQuotes[0];
          resolvedTicker = globalQuote.symbol;
          resolvedExchange = globalQuote.exchange || "GLOBAL";
          logs.push(`Resolved search to global equity: ${resolvedTicker} (${resolvedExchange})`);
        }
      } else {
        // Fall back to first quote in list
        const firstQuote = quotes[0];
        resolvedTicker = firstQuote.symbol;
        resolvedExchange = firstQuote.exchange || "GLOBAL";
        logs.push(`Resolved search to symbol: ${resolvedTicker} (${resolvedExchange})`);
      }
    } else {
      // Guess ticker as last resort (Indian market default)
      resolvedTicker = `${potentialTicker}.NS`;
      resolvedExchange = "NSE (Guess)";
      logs.push(`No quotes returned from search. Guessing ticker "${resolvedTicker}"`);
    }
  } catch (error: any) {
    resolvedTicker = `${potentialTicker}.NS`;
    resolvedExchange = "NSE (Guess)";
    logs.push(`Search failed: ${error.message || error}. Guessing ticker "${resolvedTicker}"`);
  }

  return {
    ticker: resolvedTicker,
    exchange: resolvedExchange,
    logs,
  };
}
