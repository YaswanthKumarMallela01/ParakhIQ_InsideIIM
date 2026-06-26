import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentState } from "../state";

export async function buildThesisNode(state: typeof AgentState.State) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    temperature: 0.4,
  });

  const isRevision = state.loopCount > 0;
  const logs: string[] = [];

  logs.push(
    isRevision
      ? `Revising investment thesis (Loop ${state.loopCount}/2) with new disconfirming evidence...`
      : `Synthesizing gathered data into initial investment thesis...`
  );

  const formattedNews = state.newsArticles
    .map((n, i) => `[${i + 1}] Title: ${n.title}\nSource/URL: ${n.url}\nSummary: ${n.content}`)
    .join("\n\n");

  const formattedFundamentals = `
- Ticker: ${state.ticker} (${state.exchange})
- Market Cap: ${
    state.fundamentals.marketCap !== "unavailable"
      ? `₹${(Number(state.fundamentals.marketCap) / 10000000).toFixed(2)} Cr`
      : "Unavailable"
  }
- P/E Ratio: ${state.fundamentals.peRatio}
- 52-Week Range: ${state.fundamentals.fiftyTwoWeekLow} - ${state.fundamentals.fiftyTwoWeekHigh}
- Debt/Equity Ratio: ${state.fundamentals.debtToEquity}
- Promoter Holding: ${
    state.fundamentals.promoterHolding !== "unavailable"
      ? `${Number(state.fundamentals.promoterHolding).toFixed(2)}%`
      : "Unavailable"
  }
  `;

  // Construct Prompt
  let systemPrompt = `You are an elite institutional equity analyst at ParakhIQ. Your goal is to synthesize the provided financial data and news to build a highly analytical investment thesis for a company.`;
  
  let userPrompt = `
COMPANY: ${state.companyName} (${state.ticker})
INVESTOR PROFILE: ${state.investorProfile.toUpperCase()}

--- FINANCIAL DATA ---
${formattedFundamentals}

--- SECTOR AVERAGE AND SHAREHOLDING CONTEXT (FROM WEB SEARCH) ---
${state.sectorContext}

--- RECENT NEWS & ARTICLES ---
${formattedNews}
  `;

  if (isRevision) {
    userPrompt += `
\n--- PREVIOUS THESIS ---
${state.thesis}

--- DISCONFIRMING EVIDENCE / CHALLENGE ---
${state.challengeEvidence}

Your task is to REVISE the previous thesis. Explicitly address the disconfirming evidence, modifying the thesis where appropriate. Balance the original positive points with these newly surfaced risks. Do not ignore the risks; integrate them to make the thesis more bulletproof and objective.
`;
  } else {
    userPrompt += `
Your task is to build a strong, data-driven investment thesis tailored to the investor profile (${state.investorProfile}).
Structure the thesis to highlight:
1. Core Growth Drivers & Strengths (including promoter trends and valuation metrics compared to sector average if mentioned in the context).
2. Key Operational & Financial Catalysts.
3. Tailwinds matching the investor profile (e.g., short-term momentum or long-term structural value).
Provide deep numerical and reasoning support.
`;
  }

  try {
    const response = await model.invoke([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]);

    const thesisOutput = response.content as string;

    return {
      thesis: thesisOutput,
      logs: logs.concat([
        isRevision
          ? `Revised thesis successfully generated.`
          : `Initial thesis generated.`
      ]),
    };
  } catch (error: any) {
    logs.push(`Error in build_thesis: ${error.message || error}`);
    return {
      thesis: state.thesis || "Failed to generate thesis.",
      logs,
    };
  }
}
