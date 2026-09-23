export type QuestionOption = {
  id: string;
  label: string;
};

export type GameQuestion = {
  text: string;
  options: readonly QuestionOption[];
};

export type GameGuess = {
  event: string;
  confidence: number;
  bjarneVerdict: string;
};

export type StartGameResponse = {
  sessionId: string;
  questionNumber: number;
  question: GameQuestion;
};

export type AnswerResponse = {
  questionNumber: number;
  question?: GameQuestion;
  guess?: GameGuess;
};
