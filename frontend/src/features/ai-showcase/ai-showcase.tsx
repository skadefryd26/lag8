import { Alert, Badge, Button, Container, Group, Paper, Progress, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { BjarneCriticality, BossQuestion, BossReview, Investigation, Turn } from "../avslagsgenerator/investigation-api";
import { BjarneTwists, ClauseSources } from "../avslagsgenerator/clause-cards";
import { answerAsClaimant, askBjarne, askBoss, getBossReview, getShowcaseCases, type ShowcaseCase } from "./showcase-api";
import "./ai-showcase.css";

type Exchange = { answer: string; response: Investigation };
type PendingAnswer = { question: string; answer: string };
const claimQuestions = 2;
const minimumAnswers = 8;

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
  const [bossQuestion, setBossQuestion] = useState<BossQuestion | null>(null);
  const [bossAnswer, setBossAnswer] = useState<string | null>(null);
  const [bossReview, setBossReview] = useState<BossReview | null>(null);
  const [speaker, setSpeaker] = useState<"claimant" | "bjarne" | "boss" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedCase = cases.data?.find((item) => item.id === selectedId) ?? cases.data?.[0];

  const opening = useMutation({
    mutationFn: (scenario: ShowcaseCase) => askBjarne(scenario, [], criticality),
    onSuccess: (result) => { setOpeningResult(result); setLatest(result); if (result.done && result.status !== "referred") setPlaying(false); },
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
      if (response.done && response.status !== "referred") setPlaying(false);
    },
    onError: () => { setPlaying(false); setSpeaker(null); },
  });

  const bossOpening = useMutation({
    mutationFn: ({ scenario, history, assessment }: { scenario: ShowcaseCase; history: Turn[]; assessment: Investigation }) => {
      setSpeaker("boss");
      return askBoss({ claim: scenario.claim, turns: history, bjarne: assessment });
    },
    onSuccess: (question) => { setBossQuestion(question); setSpeaker(null); },
    onError: () => { setPlaying(false); setSpeaker(null); },
  });

  const bossTurn = useMutation({
    mutationFn: async ({ scenario, history, assessment, question, savedAnswer }: {
      scenario: ShowcaseCase; history: Turn[]; assessment: Investigation; question: BossQuestion; savedAnswer: string | null;
    }) => {
      setSpeaker(savedAnswer ? "boss" : "claimant");
      const answer = savedAnswer ?? await answerAsClaimant(scenario.id, question.question, history, true);
      setBossAnswer(answer);
      setSpeaker("boss");
      return getBossReview({ claim: scenario.claim, turns: history, bjarne: assessment }, question.question, answer);
    },
    onSuccess: (review) => { setBossReview(review); setSpeaker(null); setPlaying(false); },
    onError: () => { setPlaying(false); setSpeaker(null); },
  });

  const needsBoss = latest?.done && latest.status === "referred";
  const complete = latest?.done && (!needsBoss || Boolean(bossReview));
  const busy = opening.isPending || nextTurn.isPending || bossOpening.isPending || bossTurn.isPending;
  const error = opening.error ?? nextTurn.error ?? bossOpening.error ?? bossTurn.error;

  function advance() {
    if (!activeCase || !latest || busy) return;
    if (!latest.done) {
      nextTurn.reset();
      nextTurn.mutate({ scenario: activeCase, question: latest.nextQuestion, history: turns, savedAnswer: pendingAnswer });
    } else if (needsBoss && !bossQuestion) {
      bossOpening.reset();
      bossOpening.mutate({ scenario: activeCase, history: turns, assessment: latest });
    } else if (needsBoss && bossQuestion && !bossReview) {
      bossTurn.reset();
      bossTurn.mutate({ scenario: activeCase, history: turns, assessment: latest, question: bossQuestion, savedAnswer: bossAnswer });
    }
  }

  // One timer per completed exchange gives the audience time to read and is cancelled on pause/unmount.
  useEffect(() => {
    if (!playing || !activeCase || !latest || complete || busy || error) return;
    const timer = window.setTimeout(() => {
      advance();
    }, 2400);
    return () => window.clearTimeout(timer);
  // State transitions (and pause) cancel the old timer; only one next action is scheduled.
  }, [playing, activeCase, latest, turns, pendingAnswer, bossQuestion, bossAnswer, bossReview, busy, error]);

  useEffect(() => {
    if (activeCase) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeCase, exchanges, pendingAnswer, latest, bossQuestion, bossAnswer, bossReview]);

  function start(autoplay: boolean) {
    if (!selectedCase) return;
    opening.reset();
    nextTurn.reset();
    bossOpening.reset();
    bossTurn.reset();
    setActiveCase(selectedCase);
    setTurns([]);
    setExchanges([]);
    setPendingAnswer(null);
    setOpeningResult(null);
    setLatest(null);
    setBossQuestion(null);
    setBossAnswer(null);
    setBossReview(null);
    setPlaying(autoplay);
    opening.mutate(selectedCase);
  }

  const turnsUsed = turns.length + (pendingAnswer ? 1 : 0);
  const citedClauses = [...new Map([openingResult, ...exchanges.map(({ response }) => response)]
    .flatMap((result) => result?.clauses ?? []).reverse().map((clause) => [clause.id, clause])).values()];

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
          <Text c="dimmed">Følg to skadespørsmål, seks absurde bakgrunnsspørsmål og eventuelt sjefens ekstra kontroll. Publikum ser hvilke fakta Bjarne bruker, hvilke vilkår han viser til og hvorfor han lander der han lander.</Text>
        </section>

        {!activeCase ? (
          <section aria-label="Velg demosak" className="showcase-setup">
            <Text className="eyebrow">01 / VELG EN SAK</Text>
            {cases.isError ? <Alert color="red" mt="md">{cases.error.message} <Button variant="subtle" onClick={() => cases.refetch()}>Prøv igjen</Button></Alert> : null}
            {cases.isPending ? <Text mt="md">Bjarne finner fram saksmapper ...</Text> : null}
            <div className="showcase-cases">
              {cases.data?.map((scenario) => (
                <button key={scenario.id} type="button" className={`showcase-case ${selectedCase?.id === scenario.id ? "selected" : ""}`} onClick={() => setSelectedId(scenario.id)} aria-pressed={selectedCase?.id === scenario.id}>
                  <span className="eyebrow">{scenario.category} · {scenario.policyId === "innboPluss" ? "Innbo Pluss" : "Reise Pluss"}</span>
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
              <Text c="dimmed" size="sm" mt="md">Bjarne bruker offentlige alminnelige vilkår for valgt produkt, aldri en individuell avtale. Alle saker og personer er oppdiktet.</Text>
            </Paper>
          </section>
        ) : (
          <section className="showcase-stage" aria-label="AI mot AI-samtale">
            <Group justify="space-between" align="flex-start" gap="md" mb="lg">
              <div><Text className="eyebrow">PÅ SCENEN · {activeCase.category.toUpperCase()}</Text><Title order={2}>{activeCase.title}</Title></div>
              <Button variant="subtle" color="gray" disabled={busy} onClick={() => { setPlaying(false); setActiveCase(null); setLatest(null); setOpeningResult(null); setPendingAnswer(null); setBossQuestion(null); setBossAnswer(null); setBossReview(null); opening.reset(); nextTurn.reset(); bossOpening.reset(); bossTurn.reset(); }}>Velg ny sak ↺</Button>
            </Group>
            <div className="showcase-grid">
              <div>
                <div className="showcase-roster" aria-label="Roller"><span>◉ SKADELIDT <small>AI · kjenner saksfakta</small></span><span>VS</span><span>◉ BJARNE <small>AI · {activeCase.policyId === "innboPluss" ? "Innbo Pluss" : "Reise Pluss"}</small></span><span>↗ SJEFEN <small>AI · ved videre utredning</small></span></div>
                <Stack className="showcase-transcript" gap="lg" aria-live="polite">
                  <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · AI</Text><Text>{activeCase.claim}</Text></div></div>
                  {openingResult ? <div className="message-row"><div className="avatar" aria-hidden="true">B</div><div className="message-bubble bjarne-bubble"><Text className="bubble-label">BJARNE · AI · SKADEFORHØR</Text><Text className="bjarne-message">{openingResult.message}</Text><BjarneTwists clauses={openingResult.clauses ?? []} />{!openingResult.done ? <Text className="bjarne-question" mt="sm">{openingResult.nextQuestion}</Text> : null}</div></div> : null}
                  {exchanges.map(({ answer, response }, index) => (
                    <div className="showcase-exchange" key={index}>
                      <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · AI</Text><Text>{answer}</Text></div></div>
                      <div className="message-row"><div className="avatar" aria-hidden="true">B</div><div className="message-bubble bjarne-bubble"><Text className="bubble-label">BJARNE · AI · {index + 1 < claimQuestions ? "SKADEFORHØR" : "BAKGRUNNSFORHØR"}</Text><Text className="bjarne-message">{response.message}</Text><BjarneTwists clauses={response.clauses ?? []} />{!response.done ? <Text className="bjarne-question" mt="sm">{response.nextQuestion}</Text> : null}</div></div>
                    </div>
                  ))}
                  {pendingAnswer ? <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · AI</Text><Text>{pendingAnswer.answer}</Text></div></div> : null}
                  {latest?.done ? <Paper className="showcase-verdict" p="xl" radius="lg" role="status"><Text className="eyebrow">BJARNES FIKTIVE SLUTTRESULTAT</Text><Title order={3} mt="sm">{latest.status === "possible_rejection" ? "Mulig avslag 👀" : "Sendt til videre utredning 🗂️"}</Title>{latest.possibleIssue ? <Text mt="md">{latest.possibleIssue}</Text> : null}{latest.status === "referred" ? <Text mt="md" className="issue-note">Mottaker: {latest.thirdParty} (oppdiktet)</Text> : null}<Text mt="sm">{latest.reasoningSummary}</Text><Text fw={700} mt="md">{latest.coverage === "possible_rejection" ? "Mulig grunnlag mot dekning" : "Dekning uavklart"}</Text>{latest.source ? <Text size="sm" mt="sm">Kilde: <a href={latest.source.url} target="_blank" rel="noreferrer">{latest.source.product}, {latest.source.section}, PDF-side {latest.source.page}</a>. {latest.source.excerpt}</Text> : null}{latest.escalation ? <Text size="sm" mt="sm">Bjarnes fiktive nødeskalering: {latest.escalation}</Text> : null}<Text c="dimmed" size="sm" mt="md">Offentlige alminnelige vilkår er bare et oppslag. Dette er en lek, ikke en dekningsavgjørelse; den individuelle avtalen gjelder.</Text></Paper> : null}
                  {bossQuestion ? <div className="message-row"><div className="avatar boss-avatar" aria-hidden="true">S</div><div className="message-bubble boss-bubble"><Text className="bubble-label">SJEFEN · EKSTRA KONTROLL</Text><Text>{bossQuestion.message}</Text><Text className="boss-question" mt="sm">{bossQuestion.question}</Text></div></div> : null}
                  {bossAnswer ? <div className="message-row message-row-user"><div className="message-bubble showcase-claimant"><Text className="bubble-label">SKADELIDT · TIL SJEFEN</Text><Text>{bossAnswer}</Text></div></div> : null}
                  {bossReview ? <Paper className="boss-card" p="xl" radius="lg" role="status"><Text className="eyebrow">ESKALERT · SJEFENS KONTOR</Text><Title order={3} mt="sm">{{ possible_issue: "Sjefen fant en mulig innvending", nothing_found: "Selv sjefen fant ikke noe", needs_information: "Sjefen krever en opplysning til" }[bossReview.conclusion]}</Title><Text mt="md">{bossReview.message}</Text><Text className="issue-note" mt="md">{bossReview.scrutiny}</Text><Text c="dimmed" size="sm" mt="md">Dette er satire, ikke en faktisk dekningsavgjørelse.</Text></Paper> : null}
                  {busy ? <Paper className="showcase-thinking" p="md" radius="md" role="status"><span className="thinking-dots" aria-hidden="true">•••</span> {speaker === "claimant" ? "Skadelidte leter etter et ærlig svar ..." : speaker === "boss" ? "Sjefen gjennomgår Bjarnes arbeid med lupe ..." : "Bjarne gransker detaljene og savner kaffe ..."}</Paper> : null}
                  <div ref={bottomRef} />
                </Stack>
                {error ? <Alert color="red" title="Forestillingen tok en pause" mt="md">{error.message} Samtalen er bevart; prøv samme steg igjen.</Alert> : null}
                <Group mt="lg" gap="sm">
                  {opening.isError ? <Button color="yellow" onClick={() => { opening.reset(); opening.mutate(activeCase); }}>Prøv å starte igjen ↻</Button> : null}
                  {!complete && latest && !playing ? <Button color="yellow" onClick={advance} disabled={busy}>{error ? "Prøv steget igjen ↻" : needsBoss ? bossQuestion ? "La skadelidte svare sjefen →" : "Be om sjefen →" : "Neste replikk →"}</Button> : null}
                  {!complete && latest ? <Button variant="outline" color="yellow" onClick={() => setPlaying(!playing)} disabled={Boolean(error)}>{playing ? "Pause etter denne replikken ‖" : "▶ Spill av automatisk"}</Button> : null}
                  {complete ? <Button color="yellow" onClick={() => { setActiveCase(null); setLatest(null); setOpeningResult(null); setBossQuestion(null); setBossAnswer(null); setBossReview(null); }}>Prøv en annen sak →</Button> : null}
                </Group>
              </div>
              <aside className="showcase-sidebar">
                <Paper p="lg" radius="lg"><Text className="eyebrow">RUNDESTATUS</Text><Text className="showcase-big" mt="sm">{Math.min(turnsUsed, minimumAnswers)} <small>/ {minimumAnswers} svar</small></Text><Progress value={Math.min(turnsUsed / minimumAnswers * 100, 100)} color="yellow" mt="sm" /><Text c="dimmed" size="sm" mt="md">{needsBoss ? bossReview ? "Sjefen har avsagt sin fiktive vurdering." : "Bjarnes sak er hos sjefen." : latest?.done ? "Saken er ferdig vurdert." : turnsUsed >= claimQuestions ? "Bakgrunnsforhør · oppdiktede forbindelser og proveniens." : "Skadeforhør · hendelsen og vilkår."} {playing && !complete ? "Automatisk avspilling pågår." : !complete ? "Pauset: Publikum bestemmer tempoet." : ""}</Text></Paper>
                <Paper p="lg" radius="lg" mt="md"><Text className="eyebrow">BJARNES HÅP OM AVSLAG</Text><Text className="showcase-big" mt="sm">{latest?.rejectionHope ?? 78}%</Text><Progress value={latest?.rejectionHope ?? 78} color="yellow" mt="sm" /><Text c="dimmed" size="xs" mt="sm">Kun Bjarnes optimisme – aldri sannsynlighet for avslag.</Text></Paper>
                {latest?.relevantFacts.length ? <Paper p="lg" radius="lg" mt="md"><Text className="eyebrow">FAKTA SOM BLE OPPGITT</Text>{latest.relevantFacts.slice(0, 4).map((fact, index) => <Text size="sm" mt="sm" key={index}>↳ {fact}</Text>)}</Paper> : null}
                {citedClauses.length ? <Paper p="lg" radius="lg" mt="md"><ClauseSources clauses={citedClauses} /></Paper> : null}
              </aside>
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
