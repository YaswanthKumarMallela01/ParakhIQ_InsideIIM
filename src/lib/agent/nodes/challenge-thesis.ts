import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { AgentState } from "../state";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

// Structured schema for challenge assessment
const challengeSchema = z.object({
  hasMaterialEvidence: z.boolean().describe("Set to true ONLY if we found concrete, negative financial/operational facts or developments that are NOT already addressed in the thesis and require us to revise/tone down our outlook."),
  challengeEvidence: z.string().describe("A summary of the negative evidence or risks surfaced by the search. If hasMaterialEvidence is false, summarize the search results briefly but note why they are not new or material."),
  explanation: z.string().describe("A brief explanation of your decision (e.g. why the evidence is material or why it's already accounted for).")
});

export async function challengeThesisNode(state: typeof AgentState.State) {
  const companyName = state.companyName;
  const ticker = state.ticker;
  const currentThesis = state.thesis;
  const loopCount = state.loopCount;
  const logs: string[] = [];

  logs.push(`Challenging the thesis: searching for negative news, risks, and bear arguments...`);

  // 1. Search for disconfirming / bearish news
  let bearContext = "";
  try {
    const query = `"${companyName}" OR "${ticker}" risks negative critique problems debt high valuation drop 2026`;
    const searchResult = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: 6,
    });

    bearContext = searchResult.results?.map((r: any) => `Title: ${r.title}\nContent: ${r.content}\nURL: ${r.url}`).join("\n\n") || "No bearish results found.";
  } catch (error: any) {
    logs.push(`Warning: Bearish search failed: ${error.message || error}`);
    bearContext = "Web search failed.";
  }

  // 2. Ask Gemini to evaluate the disconfirming evidence
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    temperature: 0.1, // low temperature for analytical evaluation
  });

  const structuredModel = model.withStructuredOutput(challengeSchema);

  const systemPrompt = `You are a skeptical, independent risk manager at ParakhIQ. Your job is to examine an investment thesis and actively look for disconfirming evidence to see if it holds up under pressure. You must be objective, factual, and avoid generic pessimism.`;

  const userPrompt = `
COMPANY: ${companyName} (${ticker})
CURRENT THESIS:
${currentThesis}

--- RECENT BEARISH/RISK SEARCH RESULTS ---
${bearContext}

Your task:
1. Carefully compare the recent risk search results against the CURRENT THESIS.
2. Determine if the search results contain material, concrete, negative developments, financial metrics, or operational facts that are NOT currently addressed in the thesis.
3. If they do, set hasMaterialEvidence = true and outline these details in challengeEvidence. This will trigger a revision loop.
4. If the risks are already fully addressed, or if they are purely speculative/immaterial, set hasMaterialEvidence = false.
5. Provide a clear, objective explanation.

Note: We are on loop iteration ${loopCount + 1}/2. If this is iteration 2, we will proceed regardless of hasMaterialEvidence, but we still want to capture the challenge details for the record.
`;

  try {
    const result = await structuredModel.invoke([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]);

    const hasMaterial = result.hasMaterialEvidence;
    const challengeEvidence = result.challengeEvidence;
    const explanation = result.explanation;

    logs.push(`Challenge result: hasMaterialEvidence = ${hasMaterial}. Explanation: ${explanation}`);

    const challengeRound = {
      loopIndex: loopCount,
      evidence: challengeEvidence,
      reviewResult: explanation,
    };

    return {
      challengeEvidence,
      hasMaterialEvidence: hasMaterial,
      challengeHistory: [challengeRound],
      loopCount: hasMaterial ? state.loopCount + 1 : state.loopCount,
      logs,
    };
  } catch (error: any) {
    logs.push(`Error in challenge_thesis node: ${error.message || error}`);
    return {
      challengeEvidence: "Failed to evaluate challenge.",
      hasMaterialEvidence: false,
      logs,
    };
  }
}
