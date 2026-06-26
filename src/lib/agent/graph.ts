import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import { intakeNode } from "./nodes/intake";
import { resolveTickerNode } from "./nodes/resolve-ticker";
import { gatherDataNode } from "./nodes/gather-data";
import { buildThesisNode } from "./nodes/build-thesis";
import { challengeThesisNode } from "./nodes/challenge-thesis";
import { reviseOrProceed } from "./nodes/revise-or-proceed";
import { synthesizeVerdictNode } from "./nodes/synthesize-verdict";
import { writeMemoNode } from "./nodes/write-memo";

const workflow = new StateGraph(AgentState)
  .addNode("intake", intakeNode)
  .addNode("resolve_ticker", resolveTickerNode)
  .addNode("gather_data", gatherDataNode)
  .addNode("build_thesis", buildThesisNode)
  .addNode("challenge_thesis", challengeThesisNode)
  .addNode("synthesize_verdict", synthesizeVerdictNode)
  .addNode("write_memo", writeMemoNode)
  
  .addEdge(START, "intake")
  .addEdge("intake", "resolve_ticker")
  .addEdge("resolve_ticker", "gather_data")
  .addEdge("gather_data", "build_thesis")
  .addEdge("build_thesis", "challenge_thesis")
  
  .addConditionalEdges("challenge_thesis", reviseOrProceed, {
    revise: "build_thesis",
    proceed: "synthesize_verdict",
  })
  
  .addEdge("synthesize_verdict", "write_memo")
  .addEdge("write_memo", END);

export const graph = workflow.compile();

/**
 * Runner function that streams state changes for a research request
 */
export async function runResearchAgent(
  companyName: string,
  investorProfile: "conservative" | "aggressive"
) {
  return graph.stream(
    {
      companyName,
      investorProfile,
      loopCount: 0,
      challengeHistory: [],
    },
    { streamMode: "updates" }
  );
}
