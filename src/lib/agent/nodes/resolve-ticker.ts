import yahooFinance from "yahoo-finance2";
import { AgentState } from "../state";

export async function resolveTickerNode(state: typeof AgentState.State) {
  const query = state.companyName;
  let resolvedTicker = "";
  let resolvedExchange = "";
  let logs: string[] = [];

  try {
    const searchResults = (await yahooFinance.search(query, { lang: "en-US" })) as any;
    const quotes = searchResults.quotes || [];

    if (quotes.length > 0) {
      // 1. Try to find NSE or BSE tickers (.NS or .BO)
      const indianQuote = quotes.find(
        (q: any) =>
          q.symbol?.endsWith(".NS") ||
          q.symbol?.endsWith(".BO") ||
          q.exchange === "NSI" ||
          q.exchange === "BOM"
      );

      if (indianQuote) {
        resolvedTicker = indianQuote.symbol;
        resolvedExchange = indianQuote.exchange || (resolvedTicker.endsWith(".NS") ? "NSE" : "BSE");
        logs.push(`Resolved to ${resolvedTicker} (${resolvedExchange}) from query "${query}"`);
      } else {
        // 2. Fall back to any global quote
        const globalQuote = quotes[0];
        resolvedTicker = globalQuote.symbol;
        resolvedExchange = globalQuote.exchange || "GLOBAL";
        logs.push(
          `No NSE/BSE ticker found. Resolved to global ticker ${resolvedTicker} (${resolvedExchange}) from query "${query}"`
        );
      }
    } else {
      // 3. Fallback: if search returns nothing, try appending .NS as a guess
      resolvedTicker = `${query.toUpperCase().replace(/\s+/g, "")}.NS`;
      resolvedExchange = "NSE (Guess)";
      logs.push(`No quotes returned from search. Guessing ticker "${resolvedTicker}"`);
    }
  } catch (error: any) {
    // 4. Handle errors
    resolvedTicker = `${query.toUpperCase().replace(/\s+/g, "")}.NS`;
    resolvedExchange = "NSE (Guess)";
    logs.push(`Error resolving ticker: ${error.message || error}. Falling back to guessed ticker "${resolvedTicker}"`);
  }

  return {
    ticker: resolvedTicker,
    exchange: resolvedExchange,
    logs,
  };
}
