export type Turn = { question: string; answer: string };
export type BjarneCriticality = "nice" | "neutral" | "critical";

export type Investigation = {
  message: string;
  status: "investigating" | "possible_rejection" | "referred";
  nextQuestion: string;
  rejectionHope: number;
  claimSummary: string;
  relevantFacts: string[];
  possibleIssue: string;
  reasoningSummary: string;
  thirdParty: string;
  done: boolean;
};

export async function investigate(
  claim: string,
  turns: Turn[],
  criticality: BjarneCriticality,
): Promise<Investigation> {
  const response = await fetch("/api/avslagsgenerator/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim, turns, criticality }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : "Bjarne mistet papirene sine. Prøv igjen om litt.");
  }
  return body as Investigation;
}
