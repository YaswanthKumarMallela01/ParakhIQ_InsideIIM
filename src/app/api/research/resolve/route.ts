import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ quotes: [] });
    }

    const searchResults = (await yahooFinance.search(query, { lang: "en-US" })) as any;
    const quotes = searchResults.quotes || [];

    // Map to a cleaner format, prioritizing stock quotes
    const results = quotes
      .filter((q: any) => q.quoteType === "EQUITY")
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
      }));

    return NextResponse.json({ quotes: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
