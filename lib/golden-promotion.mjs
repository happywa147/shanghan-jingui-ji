export function evaluateGoldenCandidate(candidate, reviewerRegistry) {
  const relationTypes = new Set(["exact", "approximate", "split", "merge", "related", "no_match", "undetermined", "addition", "omission"]);
  const validateReview = (review, label) => {
    if (!review || !["accept", "reject"].includes(review.decision) || !relationTypes.has(review.proposed_relation_type) ||
        !Array.isArray(review.evidence_refs) || review.evidence_refs.length === 0 || review.evidence_refs.some((item) => typeof item !== "string" || !item.trim()) ||
        Number.isNaN(Date.parse(review.reviewed_at))) throw new Error(`${label}结构或证据无效`);
  };
  const first = candidate.first_review;
  const second = candidate.second_review;
  if (!first) return { state: "awaiting_first_review", status: "candidate" };
  validateReview(first, "初审");
  if (!second) return { state: "awaiting_second_review", status: "candidate" };
  validateReview(second, "复审");
  if (first.reviewer_id === second.reviewer_id) throw new Error("初审与复审不得为同一人");

  const requireVerified = (review, role) => {
    if (!reviewerRegistry) return;
    const reviewer = reviewerRegistry.get(review.reviewer_id);
    if (!reviewer?.active || !reviewer.roles?.includes(role) || Number.isNaN(Date.parse(reviewer.verified_at))) {
      throw new Error(`审核者未通过有效身份/角色验证: ${review.reviewer_id}`);
    }
    if (reviewer.conflict_alignment_ids?.includes(candidate.alignment_id)) throw new Error(`审核者存在利益冲突: ${review.reviewer_id}`);
  };
  requireVerified(first, "first_review");
  requireVerified(second, "second_review");

  const agreement = first.decision === second.decision &&
    first.proposed_relation_type === second.proposed_relation_type;
  if (agreement) {
    return {
      state: "complete",
      status: first.decision === "accept" ? "golden" : "rejected",
      reviewed_relation_type: first.proposed_relation_type
    };
  }

  const adjudication = candidate.adjudication;
  if (!adjudication) return { state: "awaiting_adjudication", status: "candidate" };
  validateReview(adjudication, "裁决");
  if ([first.reviewer_id, second.reviewer_id].includes(adjudication.reviewer_id)) {
    throw new Error("裁决者不得与初审或复审为同一人");
  }
  requireVerified(adjudication, "adjudicator");
  return {
    state: "complete",
    status: adjudication.decision === "accept" ? "golden" : "rejected",
    reviewed_relation_type: adjudication.proposed_relation_type
  };
}
