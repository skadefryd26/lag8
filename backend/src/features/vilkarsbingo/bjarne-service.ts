import { randomUUID } from "node:crypto";
import type { AnswerRecord, GameGuess, GameQuestion, QuestionOption } from "./game-types.js";

const gatewayUrl = "https://genai.gjensidige.io/openai/v1/responses";
const maxQuestions = 5;

const bjarneInstructions = `Du er Bjarne, den svært kompetente, litt arrogante og kaffetørste spillverten i det fiktive forsikringsspillet Skadeorakelet. Spilleren tenker på en absurd, helt oppdiktet skadehendelse. Du skal gjette hendelsen med så få spørsmål som mulig. Spørsmålene og alternativene dine skal være latterlige, men informative. Du må aldri be om eller bruke ekte kunde-, skade- eller personopplysninger. Humoren handler bare om fiktive situasjoner, forsikringsverdenen og din egen kaffemangel. Svar på norsk.`;

const questionSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
        },
        required: ["id", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["question", "options"],
  additionalProperties: false,
} as const;

const guessSchema = {
  type: "object",
  properties: {
    event: { type: "string" },
    confidence: { type: "integer", minimum: 55, maximum: 100 },
    verdict: { type: "string" },
  },
  required: ["event", "confidence", "verdict"],
  additionalProperties: false,
} as const;

const earlyGuessSchema = {
  type: "object",
  properties: {
    shouldGuess: { type: "boolean" },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["shouldGuess", "confidence"],
  additionalProperties: false,
} as const;

function readText(response: unknown): string | undefined {
  if (!response || typeof response !== "object" || !("output" in response) || !Array.isArray(response.output)) {
    return undefined;
  }

  for (const item of response.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }
}

async function requestGateway(input: string, name: string, schema: object): Promise<string> {
  const token = process.env.AI_GATEWAY_TOKEN;
  if (!token) {
    throw new Error("AI_GATEWAY_TOKEN mangler. Bjarne jobber ikke gratis, særlig ikke uten kaffe.");
  }

  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      instructions: bjarneInstructions,
      input,
      text: {
        format: { type: "json_schema", name, strict: true, schema },
      },
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI-gatewayen svarte med ${response.status}.`);
  }
  const text = readText(await response.json());
  if (!text) {
    throw new Error("AI-gatewayen svarte uten et spillbart svar.");
  }
  return text;
}

function parseQuestion(text: string): GameQuestion {
  const candidate: unknown = JSON.parse(text);
  if (!candidate || typeof candidate !== "object" || !("question" in candidate) || !("options" in candidate)) {
    throw new Error("Bjarne stilte et spørsmål ingen kunne lese.");
  }
  const question = candidate.question;
  const options = candidate.options;
  if (typeof question !== "string" || !Array.isArray(options) || options.length < 2 || options.length > 4) {
    throw new Error("Bjarne glemte enten spørsmålet eller svarene sine.");
  }
  const validOptions = options.every(
    (option): option is QuestionOption =>
      Boolean(option) &&
      typeof option === "object" &&
      "id" in option &&
      "label" in option &&
      typeof option.id === "string" &&
      typeof option.label === "string",
  );
  if (!validOptions || new Set(options.map((option) => option.id)).size !== options.length) {
    throw new Error("Bjarne laget svaralternativer som kolliderer. Klassisk uten kaffe.");
  }
  return { text: question, options };
}

function parseGuess(text: string): GameGuess {
  const candidate: unknown = JSON.parse(text);
  if (!candidate || typeof candidate !== "object" || !("event" in candidate) || !("confidence" in candidate) || !("verdict" in candidate)) {
    throw new Error("Bjarne kom med en ufullstendig konklusjon.");
  }
  if (typeof candidate.event !== "string" || typeof candidate.verdict !== "string" || !Number.isInteger(candidate.confidence)) {
    throw new Error("Bjarne kom med en ubrukelig konklusjon.");
  }
  const confidence = candidate.confidence as number;
  return {
    event: candidate.event,
    confidence: Math.max(55, Math.min(100, confidence)),
    bjarneVerdict: candidate.verdict,
  };
}

function historyPrompt(history: readonly AnswerRecord[]) {
  return history.length === 0
    ? "Ingen svar ennå."
    : history.map((entry, index) => `${index + 1}. Spørsmål: ${entry.question}\nSvar: ${entry.selectedOption}`).join("\n\n");
}

export async function createQuestion(history: readonly AnswerRecord[]): Promise<GameQuestion> {
  const nextNumber = history.length + 1;
  const text = await requestGateway(
    `Still spørsmål ${nextNumber} av maksimalt ${maxQuestions} for å identifisere en fiktiv skadehendelse spilleren har i hodet. Bruk historikken under for å velge det mest informasjonstette neste spørsmålet. Spørsmålet må kunne besvares uten å forklare seg, med 2-4 korte og gjensidig utelukkende alternativer. Ikke gjett enda. Ikke bruk ekte forsikringsvilkår eller reelle hendelser.\n\nHistorikk:\n${historyPrompt(history)}`,
    "skadeorakelet_question",
    questionSchema,
  );
  return parseQuestion(text);
}

export async function createGuess(history: readonly AnswerRecord[]): Promise<GameGuess> {
  const text = await requestGateway(
    `Dette er slutten av runden. Ut fra svarhistorikken skal du med selvsikker, morsom stemme gjette én konkret, absurd og helt fiktiv skadehendelse spilleren tenker på. Du må være så presis som svarene tillater. Oppgi sikkerhet mellom 55 og 100 og en kort dom fra Bjarne. Ikke be om flere opplysninger.\n\nHistorikk:\n${historyPrompt(history)}`,
    "skadeorakelet_guess",
    guessSchema,
  );
  return parseGuess(text);
}

export function createSessionId() {
  return randomUUID();
}

export async function shouldGuess(history: readonly AnswerRecord[]) {
  if (history.length < 3) return false;
  if (history.length >= maxQuestions) return true;

  const text = await requestGateway(
    `Vurder om du nå kan gjette skadehendelsen med minst 85 prosent sikkerhet. Du får bare gjette tidlig hvis historikken avgrenser en tydelig, konkret hendelse. Hvis flere rimelige hendelser fortsatt passer, velger du false og stiller et spørsmål til.\n\nHistorikk:\n${historyPrompt(history)}`,
    "skadeorakelet_early_guess",
    earlyGuessSchema,
  );
  const candidate: unknown = JSON.parse(text);
  if (!candidate || typeof candidate !== "object" || !("shouldGuess" in candidate) || !("confidence" in candidate)) {
    return false;
  }
  return candidate.shouldGuess === true && Number.isInteger(candidate.confidence) && Number(candidate.confidence) >= 85;
}
