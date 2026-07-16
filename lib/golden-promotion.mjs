export function evaluateGoldenCandidate(candidate) {
  const first = candidate.first_review;
  const second = candidate.second_review;
  if (!first) return { state: "awaiting_first_review", status: "candidate" };
  if (!second) return { state: "awaiting_second_review", status: "candidate" };
  if (first.reviewer_id === second.reviewer_id) throw new Error("初审与复审不得为同一人");

  const agreement = first.decision === second.decision &&
    first.proposed_relation_type === second.proposed_relation_type;
  if (agreement) {
    return {
      state: "complete",
      status: first.decision === "accept" ? "golden" : "rejected"
    };
  }

  const adjudication = candidate.adjudication;
  if (!adjudication) return { state: "awaiting_adjudication", status: "candidate" };
  if ([first.reviewer_id, second.reviewer_id].includes(adjudication.reviewer_id)) {
    throw new Error("裁决者不得与初审或复审为同一人");
  }
  return {
    state: "complete",
    status: adjudication.decision === "accept" ? "golden" : "rejected"
  };
}
