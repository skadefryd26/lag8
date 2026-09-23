import { randomUUID } from "node:crypto";
import type { AnswerRecord, BjarneCriticality, InterrogationQuestion, QuestionOption, Rejection } from "./avslag-types.js";

const gatewayUrl = "https://genai.gjensidige.io/openai/v1/responses";
const maxQuestions = 4;

const bjarneInstructions = `Du er Bjarne, en svært kompetent, arrogant og kaffetørst skadebehandler i det fiktive forsikringsselskapet. Din jobb i Avslagsgeneratoren er alltid å finne en humoristisk grunn til å avslå en helt oppdiktet skadesak. Du bruker aldri ekte kunde-, skade- eller personopplysninger. Humoren handler bare om absurde fiktive forsikringssituasjoner og din egen kaffemangel – aldri om ekte personer. Svar alltid kort på norsk.`;

const criticalityInstructions: Record<BjarneCriticality, string> = {
  nice: "Vær varm, støttende og tilsynelatende på kundens side i hvert spørsmål. La kunden føle at du oppriktig ønsker å hjelpe, uten å avsløre at avslaget kommer. Når saken avslås, behold den falskt vennlige tonen mens du likevel avslår kravet bestemt.",
  neutral: "Vær nøktern og saklig. Still korte, faktabaserte spørsmål uten mistanke, ros eller oppmuntring. Når saken avslås, hold begrunnelsen tørr og byråkratisk uten en positiv eller kritisk tone.",
  critical: "Vær dypt paranoid og inkvisitorisk. Anta at kunden prøver å svindle i hvert spørsmål, og let aktivt etter hull og motiver. Når saken avslås, vær mistenksom, spiss og selvsikker.",
};

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

const rejectionSchema = {
  type: "object",
  properties: {
    paragraph: { type: "string" },
    reason: { type: "string" },
    verdict: { type: "string" },
  },
  required: ["paragraph", "reason", "verdict"],
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
    throw new Error("AI_GATEWAY_TOKEN mangler. Bjarne nekter å avslå noe som helst uten kaffe.");
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
    throw new Error("AI-gatewayen svarte uten et brukbart avslag.");
  }
  return text;
}

function parseQuestion(text: string): InterrogationQuestion {
  const candidate: unknown = JSON.parse(text);
  if (!candidate || typeof candidate !== "object" || !("question" in candidate) || !("options" in candidate)) {
    throw new Error("Bjarne stilte et forhørsspørsmål ingen kunne lese.");
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

function parseRejection(text: string): Rejection {
  const candidate: unknown = JSON.parse(text);
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("paragraph" in candidate) ||
    !("reason" in candidate) ||
    !("verdict" in candidate)
  ) {
    throw new Error("Bjarne kom med et ufullstendig avslag.");
  }
  if (
    typeof candidate.paragraph !== "string" ||
    typeof candidate.reason !== "string" ||
    typeof candidate.verdict !== "string"
  ) {
    throw new Error("Bjarne kom med et ubrukelig avslag.");
  }
  return {
    paragraph: candidate.paragraph,
    reason: candidate.reason,
    bjarneVerdict: candidate.verdict,
  };
}

function claimAndHistoryPrompt(claim: string, history: readonly AnswerRecord[]) {
  const historyText =
    history.length === 0
      ? "Ingen svar ennå."
      : history
          .map((entry, index) => `${index + 1}. Spørsmål: ${entry.question}\nSvar: ${entry.selectedOption}`)
          .join("\n\n");
  return `Kundens fiktive skademelding:\n${claim}\n\nForhørshistorikk:\n${historyText}`;
}

export function createSessionId() {
  return randomUUID();
}

export async function createQuestion(
  claim: string,
  history: readonly AnswerRecord[],
  criticality: BjarneCriticality,
): Promise<InterrogationQuestion> {
  const nextNumber = history.length + 1;
  const text = await requestGateway(
    `Kunden har meldt inn en fiktiv skadesak. Still spørsmål ${nextNumber} av maksimalt ${maxQuestions} for å finne en oppfinnsom avslagsgrunn. ${criticalityInstructions[criticality]} Spørsmålet skal være absurd og informativt, med 2-4 korte, gjensidig utelukkende alternativer. Ikke avslå ennå. Ikke bruk ekte forsikringsvilkår eller reelle hendelser.\n\n${claimAndHistoryPrompt(claim, history)}`,
    "avslag_question",
    questionSchema,
  );
  return parseQuestion(text);
}

export async function createRejection(
  claim: string,
  history: readonly AnswerRecord[],
  criticality: BjarneCriticality,
): Promise<Rejection> {
  const text = await requestGateway(
    `Forhøret er over. Uansett hva kunden har svart, skal du nå AVSLÅ kravet. ${criticalityInstructions[criticality]} Finn en kreativ, byråkratisk begrunnelse basert på forhøret – jo mer åpenbart dekket saken virket, jo mer oppfinnsom må du være for å likevel finne et avslagsgrunnlag. Oppgi en oppdiktet paragraf (f.eks. «§ 14-3 bokstav q»), en formell avslagsbegrunnelse, og en kort kommentar fra Bjarne. Ikke tilby noe. Ikke be om mer informasjon.\n\n${claimAndHistoryPrompt(claim, history)}`,
    "avslag_rejection",
    rejectionSchema,
  );
  return parseRejection(text);
}

export { maxQuestions };
