export type Turn = { question: string; answer: string };
export type BjarneCriticality = "nice" | "neutral" | "critical";

export type Investigation = {
  message: string;
  status: "investigating" | "possible_rejection" | "bjarne_lost" | "more_information";
  nextQuestion: string;
  rejectionHope: number;
  claimSummary: string;
  relevantFacts: string[];
  possibleIssue: string;
  reasoningSummary: string;
  done: boolean;
};

export type BossReview = {
  message: string;
  scrutiny: string;
  conclusion: "possible_issue" | "nothing_found" | "needs_information";
};

async function postReview<T>(path: string, payload: object): Promise<T> {
  const response = await fetch(`/api/avslagsgenerator/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : "Bjarne mistet papirene sine. Prøv igjen om litt.");
  }
  return body as T;
}

export async function investigate(
  claim: string,
  turns: Turn[],
  criticality: BjarneCriticality,
): Promise<Investigation> {
  return postReview<Investigation>("investigate", { claim, turns, criticality });
}

export async function escalate(claim: string, turns: Turn[], bjarne: Investigation): Promise<BossReview> {
  return postReview<BossReview>("escalate", {
    claim, turns, bjarne: { message: bjarne.message, status: bjarne.status, reasoningSummary: bjarne.reasoningSummary },
  });
}
