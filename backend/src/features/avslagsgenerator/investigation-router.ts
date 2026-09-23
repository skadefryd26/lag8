import { Router } from "express";
import { reviewByBoss, type BjarneAssessment } from "./boss.js";
import { investigate, maxAnswers, type BjarneCriticality, type Turn } from "./investigation.js";

export const investigationRouter = Router();

const validText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit;

function validCase(claim: unknown, turns: unknown): turns is Turn[] {
  return validText(claim, 1500) && Array.isArray(turns) && turns.length <= maxAnswers &&
    turns.every((turn: unknown): turn is Turn =>
      Boolean(turn) && typeof turn === "object" &&
      validText((turn as Turn).question, 500) && validText((turn as Turn).answer, 1500));
}

investigationRouter.post("/investigate", async (request, response, next) => {
  const { claim, turns, criticality } = request.body ?? {};

  if (!validCase(claim, turns) || !["nice", "neutral", "critical"].includes(criticality)) {
    response.status(400).json({ error: "Skriv en kort skademelding og svar på ett spørsmål om gangen (maks seks svar)." });
    return;
  }

  try {
    response.json(await investigate(claim.trim(), turns, criticality as BjarneCriticality));
  } catch (error) {
    next(error);
  }
});

investigationRouter.post("/escalate", async (request, response) => {
  const { claim, turns, bjarne } = request.body ?? {};
  if (!validCase(claim, turns) || !bjarne || typeof bjarne !== "object" ||
    !validText(bjarne.message, 2000) || !validText(bjarne.reasoningSummary, 2000) ||
    !["investigating", "possible_rejection", "bjarne_lost", "more_information"].includes(bjarne.status)) {
    response.status(400).json({ error: "Sjefen trenger en fiktiv sak og Bjarnes siste vurdering." });
    return;
  }

  try {
    response.json(await reviewByBoss(claim.trim(), turns, bjarne as BjarneAssessment));
  } catch (error) {
    console.error("Sjefen kunne ikke svare:", error instanceof Error ? error.message : "Ukjent feil");
    response.status(502).json({ error: "Sjefen klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." });
  }
});
