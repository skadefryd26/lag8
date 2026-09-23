import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { startTransition, useState } from "react";
import { answerQuestion, startGame } from "../api/game-api";
import type { GameGuess, GameQuestion, StartGameResponse } from "../game-types";

type GameState = {
  sessionId: string;
  questionNumber: number;
  question?: GameQuestion;
  guess?: GameGuess;
};

function QuestionPanel({ game, onAnswer }: { game: GameState; onAnswer: (optionId: string) => void }) {
  if (!game.question) return null;
  return (
    <Paper className="oracle-card" p={{ base: "lg", sm: "xl" }} radius="lg">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <div>
          <Badge color="yellow" variant="light">SPØRSMÅL {game.questionNumber} AV 5</Badge>
          <Title order={2} mt="sm">{game.question.text}</Title>
        </div>
        <span className="case-emoji" aria-hidden="true">🔮</span>
      </Group>
      <Stack mt="xl" gap="sm">
        {game.question.options.map((option) => (
          <Button className="option-button" color="yellow" justify="flex-start" key={option.id} onClick={() => onAnswer(option.id)} radius="md" size="xl" variant="outline">
            {option.label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}

function GuessPanel({ guess, onRestart }: { guess: GameGuess; onRestart: () => void }) {
  return (
    <Paper className="guess-card" p={{ base: "lg", sm: "xl" }} radius="lg">
      <Badge color="teal" variant="filled">BJARNE ER SIKKER</Badge>
      <Title order={2} mt="sm">Du tenker på ...</Title>
      <Text className="guess-event" mt="md">{guess.event}</Text>
      <Progress color="teal" mt="lg" radius="xl" size="lg" value={guess.confidence} />
      <Group justify="space-between" mt="xs"><Text c="dimmed" size="sm">Beregnet sikkerhet</Text><Text fw={800}>{guess.confidence}%</Text></Group>
      <Text className="scenario" mt="xl">{guess.bjarneVerdict}</Text>
      <Button color="yellow" fullWidth mt="xl" onClick={onRestart} size="lg">Tenk på en ny fiktiv skadehendelse</Button>
    </Paper>
  );
}

export function GameBoard() {
  const [gameNumber, setGameNumber] = useState(1);
  const gameQuery = useQuery({ queryKey: ["skadeorakelet", gameNumber], queryFn: startGame, staleTime: Infinity });
  const [game, setGame] = useState<GameState>();
  const answerMutation = useMutation({
    mutationFn: ({ sessionId, optionId }: { sessionId: string; optionId: string }) => answerQuestion(sessionId, optionId),
    onSuccess: (response, variables) => {
      setGame({ sessionId: variables.sessionId, ...response });
    },
  });

  if (gameQuery.isPending) {
    return <div className="centered-state"><Loader color="yellow" /><Text>Bjarne skjerper intuisjonen. Det tar overraskende mye kaffe.</Text></div>;
  }
  if (gameQuery.isError || !gameQuery.data) {
    return <div className="centered-state"><Alert color="red" title="Orakelet er stille">{gameQuery.error?.message ?? "Bjarne klarte ikke å starte en runde."}</Alert></div>;
  }

  const start = gameQuery.data;
  const activeGame = game ?? { sessionId: start.sessionId, questionNumber: start.questionNumber, question: start.question } satisfies GameState;

  function selectAnswer(optionId: string) {
    answerMutation.mutate({ sessionId: activeGame.sessionId, optionId });
  }

  function restart() {
    startTransition(() => {
      setGame(undefined);
      setGameNumber((current) => current + 1);
    });
  }

  return (
    <main className="game-shell">
      <Container size="md" py={{ base: "xl", sm: 56 }}>
        <Stack gap="xl">
          <header className="masthead">
            <div className="bjarne-seal" aria-hidden="true">B</div>
            <div>
              <Text className="eyebrow">BJARNES INTERNFORSIKRINGSORAKEL</Text>
              <Title order={1}>Skadeorakelet</Title>
              <Text c="dimmed">Tenk på en fiktiv skadehendelse. Bjarne finner den med færrest mulig dumme spørsmål.</Text>
            </div>
          </header>

          <Group grow className="score-strip">
            <div><Text className="stat-label">MAKS SPØRSMÅL</Text><Text className="stat-value">5</Text></div>
            <div><Text className="stat-label">RUNDE</Text><Text className="stat-value">{gameNumber}</Text></div>
            <div><Text className="stat-label">BJARNES KAFFE</Text><Text className="stat-value">KRITISK</Text></div>
          </Group>

          <Progress color="yellow" radius="xl" size="sm" value={activeGame.guess ? 100 : activeGame.questionNumber / 5 * 100} />

          {answerMutation.isPending ? (
            <Paper className="thinking-card" p="lg" radius="lg"><Group><Loader size="sm" color="yellow" /><Text>Bjarne kobler sammen ting som definitivt ikke burde vært koblet sammen.</Text></Group></Paper>
          ) : activeGame.guess ? (
            <GuessPanel guess={activeGame.guess} onRestart={restart} />
          ) : (
            <QuestionPanel game={activeGame} onAnswer={selectAnswer} />
          )}

          {answerMutation.isError ? <Alert color="red" title="Bjarne mistet tråden">{answerMutation.error.message}</Alert> : null}
          {!activeGame.guess ? <Text c="dimmed" size="xs" ta="center">Hold hendelsen i hodet og velg svaret som passer best. Ingen personopplysninger, ingen ekte saker, ingen juridisk rådgivning.</Text> : null}
        </Stack>
      </Container>
    </main>
  );
}
