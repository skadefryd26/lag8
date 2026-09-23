export type QuestionOption = {
  id: string;
  label: string;
};

export type InterrogationQuestion = {
  text: string;
  options: readonly QuestionOption[];
};

export type Rejection = {
  paragraph: string;
  reason: string;
  bjarneVerdict: string;
};

export type StartCaseResponse = {
  sessionId: string;
  questionNumber: number;
  question: InterrogationQuestion;
};

export type AnswerResponse = {
  questionNumber: number;
  question?: InterrogationQuestion;
  rejection?: Rejection;
};
