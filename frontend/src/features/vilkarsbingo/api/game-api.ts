import type { AnswerResponse, StartGameResponse } from "../game-types";

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "Noe gikk galt i Bjarnes kontrollrom.";
    throw new Error(message);
  }
  return body as T;
}

export async function startGame(): Promise<StartGameResponse> {
  return readJson<StartGameResponse>(await fetch("/api/game/sessions", { method: "POST" }));
}

export async function answerQuestion(sessionId: string, optionId: string): Promise<AnswerResponse> {
  const response = await fetch(`/api/game/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  return readJson<AnswerResponse>(response);
}
