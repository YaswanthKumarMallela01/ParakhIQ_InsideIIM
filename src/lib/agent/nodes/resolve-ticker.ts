import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new YahooFinanceClass({ suppressNotices: ["yahooSurvey"] });
import { AgentState } from "../state";

export async function resolveTickerNode(state: typeof AgentState.State) {
  const query = state.companyName.trim();
  let resolvedTicker = "";
  let resolvedExchange = "";
  let resolvedCompanyName = "";
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
        resolvedCompanyName = directQuote.longName || directQuote.shortName || query;
        logs.push(`Symbol "${resolvedTicker}" validated directly on ${resolvedExchange}.`);
        return {
          ticker: resolvedTicker,
          exchange: resolvedExchange,
          companyName: resolvedCompanyName,
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

        const selectedQuote = indianQuote || equityQuotes[0];
        resolvedTicker = selectedQuote.symbol;
        resolvedExchange = selectedQuote.exchange || (resolvedTicker.endsWith(".NS") ? "NSE" : "BSE");
        resolvedCompanyName = selectedQuote.longname || selectedQuote.shortname || query;
        logs.push(`Resolved search to: ${resolvedTicker} (${resolvedExchange})`);
      } else {
        // Fall back to first quote in list
        const firstQuote = quotes[0];
        resolvedTicker = firstQuote.symbol;
        resolvedExchange = firstQuote.exchange || "GLOBAL";
        resolvedCompanyName = firstQuote.longname || firstQuote.shortname || query;
        logs.push(`Resolved search to symbol: ${resolvedTicker} (${resolvedExchange})`);
      }
    } else {
      // Guess ticker as last resort (Indian market default)
      resolvedTicker = `${potentialTicker}.NS`;
      resolvedExchange = "NSE (Guess)";
      resolvedCompanyName = query;
      logs.push(`No quotes returned from search. Guessing ticker "${resolvedTicker}"`);
    }
  } catch (error: any) {
    resolvedTicker = `${potentialTicker}.NS`;
    resolvedExchange = "NSE (Guess)";
    resolvedCompanyName = query;
    logs.push(`Search failed: ${error.message || error}. Guessing ticker "${resolvedTicker}"`);
  }

  return {
    ticker: resolvedTicker,
    exchange: resolvedExchange,
    companyName: resolvedCompanyName,
    logs,
  };
}
