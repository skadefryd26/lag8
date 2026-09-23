export type Turn = { question: string; answer: string };
export type PolicyId = "reisePluss" | "innboPluss";
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
  coverage: "possible_rejection" | "unclear" | "investigating";
  source: { product: string; url: string; page: number; section: string; excerpt: string } | null;
  escalation: string;
  handoffId: string | null;
};

export type InnboHandoff = { line: string; context: string };

export async function handoffToInnbo(handoffId: string): Promise<InnboHandoff> {
  const response = await fetch("/api/avslagsgenerator/handoff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoffId }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : "Innbo-Bjarne tok ikke telefonen. Prøv igjen.");
  }
  return body as InnboHandoff;
}

export async function investigate(
  claim: string,
  turns: Turn[],
  policyId: PolicyId,
  criticality: BjarneCriticality,
): Promise<Investigation> {
  const response = await fetch("/api/avslagsgenerator/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim, turns, criticality, policyId }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : "Bjarne mistet papirene sine. Prøv igjen om litt.");
  }
  return body as Investigation;
}
