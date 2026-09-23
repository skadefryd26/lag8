import { investigate, type BjarneCriticality, type Investigation, type PolicyId, type Turn } from "../avslagsgenerator/investigation-api";

export type ShowcaseCase = { id: string; policyId: PolicyId; title: string; category: string; claim: string };

async function readResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : "Demonstrasjonen mistet tråden. Prøv igjen.");
  }
  return body as T;
}

export async function getShowcaseCases(): Promise<ShowcaseCase[]> {
  return readResponse<ShowcaseCase[]>(await fetch("/api/ai-showcase/cases"));
}

export async function answerAsClaimant(caseId: string, question: string, turns: Turn[]): Promise<string> {
  const { answer } = await readResponse<{ answer: string }>(await fetch("/api/ai-showcase/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, question, turns }),
  }));
  return answer;
}

export function askBjarne(scenario: ShowcaseCase, turns: Turn[], criticality: BjarneCriticality): Promise<Investigation> {
  return investigate(scenario.claim, turns, scenario.policyId, criticality);
}
