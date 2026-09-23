import { Router } from "express";
import { investigate, maxAnswers, type BjarneCriticality, type Turn } from "./investigation.js";

export const investigationRouter = Router();

investigationRouter.post("/investigate", async (request, response, next) => {
  const { claim, turns, criticality } = request.body ?? {};
  const validText = (value: unknown, limit: number): value is string =>
    typeof value === "string" && value.trim().length > 0 && value.length <= limit;

  if (!validText(claim, 1500) || !Array.isArray(turns) || turns.length > maxAnswers ||
    !turns.every((turn: unknown): turn is Turn =>
      Boolean(turn) && typeof turn === "object" &&
      validText((turn as Turn).question, 500) && validText((turn as Turn).answer, 1500)) ||
    !["nice", "neutral", "critical"].includes(criticality)) {
    response.status(400).json({ error: "Skriv en kort skademelding og svar på ett spørsmål om gangen (maks seks svar)." });
    return;
  }

  try {
    response.json(await investigate(claim.trim(), turns, criticality as BjarneCriticality));
  } catch (error) {
    next(error);
  }
});
