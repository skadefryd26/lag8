export type Turn = { question: string; answer: string };
export type PolicyId = "reisePluss" | "innboPluss";
export type BjarneCriticality = "nice" | "neutral" | "critical";
export type CitedClause = { id: string; product: string; page: number; text: string; bjarneTwist: string };

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
  coverage: "possible_rejection" | "possibly_covered" | "unclear" | "investigating";
  source: { product: string; url: string; page: number; section: string; excerpt: string } | null;
  escalation: string;
  clauses: CitedClause[];
};

export type BossQuestion = {
  message: string;
  question: string;
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
  policyId: PolicyId,
  criticality: BjarneCriticality,
): Promise<Investigation> {
  return postReview<Investigation>("investigate", { claim, turns, criticality, policyId });
}

export type BossCase = { claim: string; turns: Turn[]; bjarne: Investigation };

function bossPayload({ claim, turns, bjarne }: BossCase) {
  return {
    claim, turns, bjarne: { message: bjarne.message, status: bjarne.status, reasoningSummary: bjarne.reasoningSummary },
  };
}

export async function escalate(context: BossCase): Promise<BossQuestion> {
  return postReview<BossQuestion>("escalate", bossPayload(context));
}

export async function answerBoss(context: BossCase, question: string, answer: string): Promise<BossReview> {
  return postReview<BossReview>("escalate/answer", { ...bossPayload(context), question, answer });
}
