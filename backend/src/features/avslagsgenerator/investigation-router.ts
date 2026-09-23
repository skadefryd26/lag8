import { Router } from "express";
import { askBossQuestion, reviewByBoss, type BjarneAssessment } from "./boss.js";
import { investigate, minimumAnswers, type BjarneCriticality, type Turn } from "./investigation.js";
import { isPolicyId } from "./vilkar.js";

export const investigationRouter = Router();

const validText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit;

function validCase(claim: unknown, turns: unknown): turns is Turn[] {
  return validText(claim, 1500) && Array.isArray(turns) && turns.length <= minimumAnswers &&
    turns.every((turn: unknown): turn is Turn =>
      Boolean(turn) && typeof turn === "object" &&
      validText((turn as Turn).question, 500) && validText((turn as Turn).answer, 1500));
}

investigationRouter.post("/investigate", async (request, response, next) => {
  const { claim, turns, criticality, policyId } = request.body ?? {};
  if (!isPolicyId(policyId) || !validCase(claim, turns) ||
    !["nice", "neutral", "critical"].includes(criticality)) {
    response.status(400).json({ error: "Velg Reise Pluss eller Innbo Pluss, og svar på åtte fiktive spørsmål ett om gangen." });
    return;
  }

  try {
    response.json(await investigate(claim.trim(), turns, policyId, criticality as BjarneCriticality));
  } catch (error) {
    next(error);
  }
});

function validBossCase(claim: unknown, turns: unknown, bjarne: unknown): bjarne is BjarneAssessment {
  if (!validCase(claim, turns) || !bjarne || typeof bjarne !== "object") return false;
  const assessment = bjarne as Partial<BjarneAssessment>;
  return validText(assessment.message, 2000) && validText(assessment.reasoningSummary, 2000) &&
    ["investigating", "possible_rejection", "referred"].includes(assessment.status ?? "");
}

investigationRouter.post("/escalate", async (request, response) => {
  const { claim, turns, bjarne } = request.body ?? {};
  if (!validBossCase(claim, turns, bjarne)) {
    response.status(400).json({ error: "Sjefen trenger en fiktiv sak og Bjarnes siste vurdering." });
    return;
  }

  try {
    response.json(await askBossQuestion(claim.trim(), turns, bjarne));
  } catch (error) {
    console.error("Sjefen kunne ikke svare:", error instanceof Error ? error.message : "Ukjent feil");
    response.status(502).json({ error: "Sjefen klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." });
  }
});

investigationRouter.post("/escalate/answer", async (request, response) => {
  const { claim, turns, bjarne, question, answer } = request.body ?? {};
  if (!validBossCase(claim, turns, bjarne) || !validText(question, 500) || !validText(answer, 1500)) {
    response.status(400).json({ error: "Svar på sjefens spørsmål med en kort beskrivelse." });
    return;
  }

  try {
    response.json(await reviewByBoss(claim.trim(), turns, bjarne, question.trim(), answer.trim()));
  } catch (error) {
    console.error("Sjefen kunne ikke svare:", error instanceof Error ? error.message : "Ukjent feil");
    response.status(502).json({ error: "Sjefen klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." });
  }
});
