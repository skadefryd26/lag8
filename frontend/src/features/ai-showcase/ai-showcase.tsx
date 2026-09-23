import { Alert, Badge, Button, Container, Group, Paper, Progress, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { BjarneCriticality, Investigation, Turn } from "../avslagsgenerator/investigation-api";
import { answerAsClaimant, askBjarne, getShowcaseCases, type ShowcaseCase } from "./showcase-api";
import { showcaseVerdict } from "./showcase-verdict";
import "./ai-showcase.css";

type Exchange = { answer: string; response: Investigation };
type PendingAnswer = { question: string; answer: string };

export function AiShowcase() {
  const cases = useQuery({ queryKey: ["ai-showcase-cases"], queryFn: getShowcaseCases });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<ShowcaseCase | null>(null);
  const [criticality, setCriticality] = useState<BjarneCriticality>("neutral");
  const [playing, setPlaying] = useState(false);
  const [openingResult, setOpeningResult] = useState<Investigation | null>(null);
  const [latest, setLatest] = useState<Investigation | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pendingAnswer, setPendingAnswer] = useState<PendingAnswer | null>(null);
  const [speaker, setSpeaker] = useState<"claimant" | "bjarne" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedCase = cases.data?.find((item) => item.id === selectedId) ?? cases.data?.[0];

  const opening = useMutation({
    mutationFn: (scenario: ShowcaseCase) => askBjarne(scenario, [], criticality),
    onSuccess: (result) => { setOpeningResult(result); setLatest(result); if (result.done) setPlaying(false); },
  });

  const nextTurn = useMutation({
    mutationFn: async ({ scenario, question, history, savedAnswer }: {
      scenario: ShowcaseCase; question: string; history: Turn[]; savedAnswer: PendingAnswer | null;
    }) => {
      setSpeaker(savedAnswer ? "bjarne" : "claimant");
      const answer = savedAnswer?.answer ?? await answerAsClaimant(scenario.id, question, history);
      setPendingAnswer({ question, answer });
      setSpeaker("bjarne");
      const updated = [...history, { question, answer }];
      const response = await askBjarne(scenario, updated, criticality);
      return { answer, updated, response };
    },
    onSuccess: ({ answer, updated, response }) => {
      setTurns(updated);
      setExchanges((previous) => [...previous, { answer, response }]);
      setLatest(response);
      setPendingAnswer(null);
      setSpeaker(null);
      if (response.done) setPlaying(false);
    },
    onError: () => { setPlaying(false); setSpeaker(null); },
  });

  // One timer per completed exchange gives the audience time to read and is cancelled on pause/unmount.
  useEffect(() => {
    if (!playing || !activeCase || !latest || latest.done || opening.isPending || nextTurn.isPending || nextTurn.isError) return;
    const timer = window.setTimeout(() => {
      nextTurn.mutate({ scenario: activeCase, question: latest.nextQuestion, history: turns, savedAnswer: pendingAnswer });
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [playing, activeCase, latest, turns, pendingAnswer, opening.isPending, nextTurn.isPending, nextTurn.isError, nextTurn.mutate]);

  useEffect(() => {
    if (activeCase) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeCase, exchanges, pendingAnswer, latest]);

  function start(autoplay: boolean) {
    if (!selectedCase) return;
    opening.reset();
    nextTurn.reset();
    setActiveCase(selectedCase);
    setTurns([]);
    setExchanges([]);
    setPendingAnswer(null);
    setOpeningResult(null);
    setLatest(null);
    setPlaying(autoplay);
    opening.mutate(selectedCase);
  }

  function advance() {
    if (!activeCase || !latest || latest.done || nextTurn.isPending) return;
    nextTurn.reset();
    nextTurn.mutate({ scenario: activeCase, question: latest.nextQuestion, history: turns, savedAnswer: pendingAnswer });
  }

  const busy = opening.isPending || nextTurn.isPending;
  const error = opening.error ?? nextTurn.error;
  const turnsUsed = turns.length + (pendingAnswer ? 1 : 0);

  return (
    <main className="showcase-shell">
      <Container size="lg" py={{ base: 26, sm: 46 }}>
        <header className="generator-header">
          <Group gap="sm"><div className="bjarne-seal" aria-hidden="true">B</div><Text className="eyebrow">SKADEFRYD / DIREKTE FRA SAKSBEHANDLINGEN</Text></Group>
          <Link to="/" className="side-link">Spill selv ↗</Link>
        </header>

        <section className="showcase-intro">
          <Badge color="yellow" variant="light" size="lg">TO AI-ER · ÉN HELT OPPDIKTET SKADE</Badge>
          <Title order={1}>AI <span>mot</span> AI<span>.</span></Title>
          <Text className="showcase-lead">En AI spiller skadelidt. Bjarne leter etter en grunn til å si nei.</Text>
          <Text c="dimmed">Følg samtalen direkte: Begge får bare vite det rollen deres vet. Publikum får se hva som faktisk blir opplyst, hva som fortsatt er uklart, og hvorfor Bjarne lander der han lander.</Text>
        </section>

        {!activeCase ? (
          <section aria-label="Velg demosak" className="showcase-setup">
            <Text className="eyebrow">01 / VELG EN SAK</Text>
            {cases.isError ? <Alert color="red" mt="md">{cases.error.message} <Button variant="subtle" onClick={() => cases.refetch()}>Prøv igjen</Button></Alert> : null}
            {cases.isPending ? <Text mt="md">Bjarne finner fram saksmapper ...</Text> : null}
            <div className="showcase-cases">
              {cases.data?.map((scenario) => (
                <button key={scenario.id} type="button" className={`showcase-case ${selectedCase?.id === scenario.id ? "selected" : ""}`} onClick={() => setSelectedId(scenario.id)} aria-pressed={selectedCase?.id === scenario.id}>
                  <span className="eyebrow">{scenario.category}</span>
                  <strong>{scenario.title}</strong>
                  <span>{scenario.claim}</span>
                </button>
              ))}
            </div>
            <Paper className="showcase-controls" p="lg" radius="lg">
              <Text className="eyebrow">02 / HVOR KRITISK SKAL BJARNE VÆRE?</Text>
              <SegmentedControl mt="sm" fullWidth value={criticality} onChange={(value) => setCriticality(value as BjarneCriticality)} data={[{ label: "Snill", value: "nice" }, { label: "Nøytral", value: "neutral" }, { label: "Kritisk", value: "critical" }]} />
              <Group mt="lg" gap="sm">
                <Button color="yellow" disabled={!selectedCase} loading={opening.isPending} onClick={() => start(true)}>▶ Start forestillingen</Button>
                <Button variant="outline" color="yellow" disabled={!selectedCase} onClick={() => start(false)}>Ta ett steg av gangen</Button>
              </Group>
              <Text c="dimmed" size="sm" mt="md">Alle saker og personer er oppdiktet. Dette er ikke en ekte dekningsvurdering.</Text>
            </Paper>
          </section>
        ) : (
          <section className="showcase-stage" aria-label="AI mot AI-samtale">
            <Group justify="space-between" align="flex-start" gap="md" mb="lg">
              <div><Text className="eyebrow">PÅ SCENEN · {activeCase.category.toUpperCase()}</Text><Title order={2}>{activeCase.title}</Title></div>
              <Button variant="subtle" color="gray" disabled={busy} onClick={() => { setPlaying(false); setActiveCase(null); setLatest(null); setOpeningResult(null); setPendingAnswer(null); opening.reset(); nextTurn.reset(); }}>Velg ny sak ↺</Button>
            </Group>
            <div className="showcase-grid">
              <div>
                <div className="showcase-roster" aria-label="Roller"><span>◉ SKADELIDT <small>AI · kjenner saksfakta</small></span><span>VS</span><span>◉ BJARNE <small>AI · undersøker saken</small></span></div>
                <Stack className="showcase-transcript" gap="lg" aria-live="polite">
                  <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · AI</Text><Text>{activeCase.claim}</Text></div></div>
                  {openingResult ? <div className="message-row"><div className="avatar" aria-hidden="true">B</div><div className="message-bubble bjarne-bubble"><Text className="bubble-label">BJARNE · AI</Text><Text>{openingResult.done ? showcaseVerdict(openingResult).message : openingResult.message}</Text>{!openingResult.done ? <Text className="bjarne-question" mt="sm">{openingResult.nextQuestion}</Text> : null}</div></div> : null}
                  {exchanges.map(({ answer, response }, index) => (
                    <div className="showcase-exchange" key={index}>
                      <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · AI</Text><Text>{answer}</Text></div></div>
                      <div className="message-row"><div className="avatar" aria-hidden="true">B</div><div className="message-bubble bjarne-bubble"><Text className="bubble-label">BJARNE · AI</Text><Text>{response.done ? showcaseVerdict(response).message : response.message}</Text>{!response.done ? <Text className="bjarne-question" mt="sm">{response.nextQuestion}</Text> : null}</div></div>
                    </div>
                  ))}
                  {pendingAnswer ? <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · AI</Text><Text>{pendingAnswer.answer}</Text></div></div> : null}
                  {busy ? <Paper className="showcase-thinking" p="md" radius="md" role="status"><span className="thinking-dots" aria-hidden="true">•••</span> {speaker === "claimant" ? "Skadelidte leter etter et ærlig svar ..." : "Bjarne gransker detaljene og savner kaffe ..."}</Paper> : null}
                  {latest?.done ? <Paper className="showcase-verdict" p="xl" radius="lg" role="status"><Text className="eyebrow">BJARNES FIKTIVE SLUTTRESULTAT</Text><Title order={3} mt="sm">{showcaseVerdict(latest).title}</Title>{latest.status === "possible_rejection" && latest.possibleIssue ? <Text mt="md">{latest.possibleIssue}</Text> : null}<Text mt="sm">{showcaseVerdict(latest).explanation}</Text><Text c="dimmed" size="sm" mt="md">En leken vurdering, ikke en dekningsavgjørelse. Faktisk dekning avhenger av avtalen og vilkårene.</Text></Paper> : null}
                  <div ref={bottomRef} />
                </Stack>
                {error ? <Alert color="red" title="Forestillingen tok en pause" mt="md">{error.message} Samtalen er bevart; prøv samme steg igjen.</Alert> : null}
                <Group mt="lg" gap="sm">
                  {opening.isError ? <Button color="yellow" onClick={() => { opening.reset(); opening.mutate(activeCase); }}>Prøv å starte igjen ↻</Button> : null}
                  {!latest?.done && latest && !playing ? <Button color="yellow" onClick={advance} disabled={busy}>{error ? "Prøv steget igjen ↻" : "Neste replikk →"}</Button> : null}
                  {!latest?.done && latest ? <Button variant="outline" color="yellow" onClick={() => { nextTurn.reset(); setPlaying(!playing); }} disabled={Boolean(error && !nextTurn.isError)}>{playing ? "Pause etter denne replikken ‖" : "▶ Spill av automatisk"}</Button> : null}
                  {latest?.done ? <Button color="yellow" onClick={() => { setActiveCase(null); setLatest(null); setOpeningResult(null); }}>Prøv en annen sak →</Button> : null}
                </Group>
              </div>
              <aside className="showcase-sidebar">
                <Paper p="lg" radius="lg"><Text className="eyebrow">RUNDESTATUS</Text><Text className="showcase-big" mt="sm">{Math.min(turnsUsed, 8)} <small>/ 8 svar</small></Text><Progress value={Math.min(turnsUsed / 8 * 100, 100)} color="yellow" mt="sm" /><Text c="dimmed" size="sm" mt="md">{latest?.done ? "Saken er ferdig vurdert." : playing ? "Automatisk avspilling pågår." : "Pauset: Publikum bestemmer tempoet."}</Text></Paper>
                <Paper p="lg" radius="lg" mt="md"><Text className="eyebrow">BJARNES HÅP OM AVSLAG</Text><Text className="showcase-big" mt="sm">{latest?.rejectionHope ?? 78}%</Text><Progress value={latest?.rejectionHope ?? 78} color="yellow" mt="sm" /><Text c="dimmed" size="xs" mt="sm">Kun Bjarnes optimisme – aldri sannsynlighet for avslag.</Text></Paper>
                {latest?.relevantFacts.length ? <Paper p="lg" radius="lg" mt="md"><Text className="eyebrow">FAKTA SOM BLE OPPGITT</Text>{latest.relevantFacts.slice(0, 4).map((fact, index) => <Text size="sm" mt="sm" key={index}>↳ {fact}</Text>)}</Paper> : null}
              </aside>
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
