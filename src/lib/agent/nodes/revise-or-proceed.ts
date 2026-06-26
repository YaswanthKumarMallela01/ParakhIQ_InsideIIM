import { AgentState } from "../state";

export function reviseOrProceed(state: typeof AgentState.State) {
  // We allow up to 2 loops (i.e. up to 2 revision cycles).
  // If loopCount is 1, it means we have done 1 revision.
  // If loopCount is 2, it means we have done 2 revisions.
  if (state.hasMaterialEvidence && state.loopCount <= 2) {
    return "revise";
  }
  return "proceed";
}
