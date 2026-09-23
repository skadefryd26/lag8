import { Router } from "express";
import type { AnswerRecord, GameQuestion } from "./game-types.js";
import { createGuess, createQuestion, createSessionId, shouldGuess } from "./bjarne-service.js";

type GameSession = {
  history: AnswerRecord[];
  question: GameQuestion;
  completed: boolean;
};

const sessions = new Map<string, GameSession>();

export const gameRouter = Router();

gameRouter.post("/sessions", async (_request, response, next) => {
  try {
    const question = await createQuestion([]);
    const sessionId = createSessionId();
    sessions.set(sessionId, { history: [], question, completed: false });
    response.status(201).json({ sessionId, questionNumber: 1, question });
  } catch (error) {
    next(error);
  }
});

gameRouter.post("/sessions/:sessionId/answers", async (request, response, next) => {
  const session = sessions.get(request.params.sessionId);
  const { optionId } = request.body ?? {};

  if (!session || session.completed) {
    response.status(400).json({ error: "Denne runden er avsluttet. Bjarne ber deg tenke på en ny skadehendelse." });
    return;
  }
  if (typeof optionId !== "string") {
    response.status(400).json({ error: "Velg ett alternativ før Bjarne begynner å anta ting." });
    return;
  }
  const selectedOption = session.question.options.find((option) => option.id === optionId);
  if (!selectedOption) {
    response.status(400).json({ error: "Det alternativet hører ikke til i Bjarnes skjema." });
    return;
  }

  session.history.push({ question: session.question.text, selectedOption: selectedOption.label });

  try {
    if (await shouldGuess(session.history)) {
      session.completed = true;
      response.json({ questionNumber: session.history.length, guess: await createGuess(session.history) });
      return;
    }

    session.question = await createQuestion(session.history);
    response.json({ questionNumber: session.history.length + 1, question: session.question });
  } catch (error) {
    next(error);
  }
});
