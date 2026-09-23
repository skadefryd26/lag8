import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { answerQuestion, startCase } from "../api/avslag-api";
import type { InterrogationQuestion, Rejection } from "../avslag-types";

const maxQuestions = 4;

type CaseState = {
  sessionId: string;
  questionNumber: number;
  question?: InterrogationQuestion;
  rejection?: Rejection;
};

function IntakePanel({
  claim,
  onClaimChange,
  onSubmit,
  isPending,
}: {
  claim: string;
  onClaimChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Paper className="oracle-card" p={{ base: "lg", sm: "xl" }} radius="lg">
      <Badge color="yellow" variant="light">MELD INN SKADE</Badge>
      <Title order={2} mt="sm">Hva har «skjedd»?</Title>
      <Text c="dimmed" mt="xs">Beskriv en oppdiktet skadesak. Bjarne vil uansett finne noe å mistenke deg for.</Text>
      <Textarea
        mt="md"
        minRows={4}
        autosize
        radius="md"
        size="md"
        placeholder="F.eks.: Katten min veltet en telefon i akvariet mens jeg lagde kaffe."
        value={claim}
        onChange={(event) => onClaimChange(event.currentTarget.value)}
      />
      <Button
        color="yellow"
        fullWidth
        mt="lg"
        size="lg"
        loading={isPending}
        disabled={claim.trim().length < 3}
        onClick={onSubmit}
      >
        Send saken til Bjarne
      </Button>
    </Paper>
  );
}

function InterrogationPanel({ game, onAnswer }: { game: CaseState; onAnswer: (optionId: string) => void }) {
  if (!game.question) return null;
  return (
    <Paper className="oracle-card" p={{ base: "lg", sm: "xl" }} radius="lg">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <div>
          <Badge color="yellow" variant="light">FORHØR {game.questionNumber} AV {maxQuestions}</Badge>
          <Title order={2} mt="sm">{game.question.text}</Title>
        </div>
        <span className="case-emoji" aria-hidden="true">🕵️</span>
      </Group>
      <Stack mt="xl" gap="sm">
        {game.question.options.map((option) => (
          <Button
            className="option-button"
            color="yellow"
            justify="flex-start"
            key={option.id}
            onClick={() => onAnswer(option.id)}
            radius="md"
            size="xl"
            variant="outline"
          >
            {option.label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}

function RejectionPanel({ rejection, onRestart }: { rejection: Rejection; onRestart: () => void }) {
  return (
    <Paper className="verdict-card verdict-wrong" p={{ base: "lg", sm: "xl" }} radius="lg">
      <Badge color="red" variant="filled">AVSLAG</Badge>
      <Title order={2} mt="sm">Kravet er avslått</Title>
      <Text className="challenge" mt="md">{rejection.paragraph}</Text>
      <Text className="scenario" mt="md">{rejection.reason}</Text>
      <Text className="chat-hint" mt="xl"><span>Bjarne: </span>{rejection.bjarneVerdict}</Text>
      <Button color="yellow" fullWidth mt="xl" onClick={onRestart} size="lg">
        Meld inn en ny fiktiv skade
      </Button>
    </Paper>
  );
}

export function AvslagBoard() {
  const [claim, setClaim] = useState("");
  const [game, setGame] = useState<CaseState>();

  const startMutation = useMutation({
    mutationFn: (text: string) => startCase(text),
    onSuccess: (response) => {
      setGame({
        sessionId: response.sessionId,
        questionNumber: response.questionNumber,
        question: response.question,
      });
    },
  });

  const answerMutation = useMutation({
    mutationFn: ({ sessionId, optionId }: { sessionId: string; optionId: string }) =>
      answerQuestion(sessionId, optionId),
    onSuccess: (response, variables) => {
      setGame({ sessionId: variables.sessionId, ...response });
    },
  });

  function selectAnswer(optionId: string) {
    if (!game) return;
    answerMutation.mutate({ sessionId: game.sessionId, optionId });
  }

  function restart() {
    setGame(undefined);
    setClaim("");
    startMutation.reset();
    answerMutation.reset();
  }

  const isThinking = startMutation.isPending || answerMutation.isPending;
  const errorMessage = answerMutation.error?.message ?? startMutation.error?.message;

  return (
    <main className="game-shell">
      <Container size="md" py={{ base: "xl", sm: 56 }}>
        <Stack gap="xl">
          <header className="masthead">
            <div className="bjarne-seal" aria-hidden="true">B</div>
            <div>
              <Text className="eyebrow">BJARNES AVSLAGSKONTOR</Text>
              <Title order={1}>Avslagsgeneratoren</Title>
              <Text c="dimmed">Meld inn en fiktiv skade. Bjarne finner alltid en grunn til å avslå.</Text>
            </div>
          </header>

          <Group grow className="score-strip">
            <div><Text className="stat-label">FORHØR MAKS</Text><Text className="stat-value">{maxQuestions}</Text></div>
            <div><Text className="stat-label">GODKJENT-RATE</Text><Text className="stat-value">0%</Text></div>
            <div><Text className="stat-label">BJARNES KAFFE</Text><Text className="stat-value">KRITISK</Text></div>
          </Group>

          {isThinking ? (
            <Paper className="thinking-card" p="lg" radius="lg">
              <Group>
                <Loader size="sm" color="yellow" />
                <Text>Bjarne leter etter noe mistenkelig. Det finner han alltid.</Text>
              </Group>
            </Paper>
          ) : game?.rejection ? (
            <RejectionPanel rejection={game.rejection} onRestart={restart} />
          ) : game?.question ? (
            <InterrogationPanel game={game} onAnswer={selectAnswer} />
          ) : (
            <IntakePanel
              claim={claim}
              onClaimChange={setClaim}
              onSubmit={() => startMutation.mutate(claim.trim())}
              isPending={startMutation.isPending}
            />
          )}

          {errorMessage ? <Alert color="red" title="Bjarne mistet tråden">{errorMessage}</Alert> : null}

          <Group justify="center">
            <Button component={Link} to="/" variant="subtle" color="gray" size="xs">
              ← Til Skadeorakelet
            </Button>
          </Group>
          <Text c="dimmed" size="xs" ta="center">
            Alt er oppdiktet. Ingen personopplysninger, ingen ekte saker, ingen juridisk rådgivning.
          </Text>
        </Stack>
      </Container>
    </main>
  );
}
