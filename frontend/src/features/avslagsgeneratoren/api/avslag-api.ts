import type { AnswerResponse, StartCaseResponse } from "../avslag-types";

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Noe gikk galt i Bjarnes avslagskontor.";
    throw new Error(message);
  }
  return body as T;
}

export async function startCase(claim: string): Promise<StartCaseResponse> {
  return readJson<StartCaseResponse>(
    await fetch("/api/avslag/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
    }),
  );
}

export async function answerQuestion(sessionId: string, optionId: string): Promise<AnswerResponse> {
  const response = await fetch(`/api/avslag/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  return readJson<AnswerResponse>(response);
}
