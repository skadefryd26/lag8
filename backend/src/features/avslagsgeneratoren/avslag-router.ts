import { Router } from "express";
import type { AnswerRecord, BjarneCriticality, InterrogationQuestion } from "./avslag-types.js";
import { createQuestion, createRejection, createSessionId, maxQuestions } from "./avslag-service.js";

type CaseSession = {
  claim: string;
  criticality: BjarneCriticality;
  history: AnswerRecord[];
  question: InterrogationQuestion;
  completed: boolean;
};

const sessions = new Map<string, CaseSession>();

export const avslagRouter = Router();

avslagRouter.post("/sessions", async (request, response, next) => {
  const { claim, criticality } = request.body ?? {};
  if (typeof claim !== "string" || claim.trim().length < 3) {
    response.status(400).json({ error: "Beskriv den fiktive skadesaken din før Bjarne begynner å mistenke deg." });
    return;
  }
  if (criticality !== "nice" && criticality !== "neutral" && criticality !== "critical") {
    response.status(400).json({ error: "Velg hvor kritisk Bjarne skal være før han åpner saken." });
    return;
  }

  try {
    const trimmedClaim = claim.trim().slice(0, 2000);
    const question = await createQuestion(trimmedClaim, [], criticality);
    const sessionId = createSessionId();
    sessions.set(sessionId, { claim: trimmedClaim, criticality, history: [], question, completed: false });
    response.status(201).json({ sessionId, questionNumber: 1, question });
  } catch (error) {
    next(error);
  }
});

avslagRouter.post("/sessions/:sessionId/answers", async (request, response, next) => {
  const session = sessions.get(request.params.sessionId);
  const { optionId } = request.body ?? {};

  if (!session || session.completed) {
    response.status(400).json({ error: "Denne saken er avgjort. Bjarne ber deg melde inn en ny fiktiv skade." });
    return;
  }
  if (typeof optionId !== "string") {
    response.status(400).json({ error: "Velg ett svar før Bjarne begynner å anta det verste." });
    return;
  }
  const selectedOption = session.question.options.find((option) => option.id === optionId);
  if (!selectedOption) {
    response.status(400).json({ error: "Det svaret hører ikke til i Bjarnes forhør." });
    return;
  }

  session.history.push({ question: session.question.text, selectedOption: selectedOption.label });

  try {
    if (session.history.length >= maxQuestions) {
      session.completed = true;
      response.json({
        questionNumber: session.history.length,
        rejection: await createRejection(session.claim, session.history, session.criticality),
      });
      return;
    }

    session.question = await createQuestion(session.claim, session.history, session.criticality);
    response.json({ questionNumber: session.history.length + 1, question: session.question });
  } catch (error) {
    next(error);
  }
});
