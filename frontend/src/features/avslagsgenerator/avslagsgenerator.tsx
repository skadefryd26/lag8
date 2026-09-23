import { Alert, Badge, Button, Container, Group, Paper, Progress, SegmentedControl, Stack, Text, Textarea, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { investigate, type BjarneCriticality, type Investigation, type PolicyId, type Turn } from "./investigation-api";

const examples = ["Jeg mistet mobilen i toalettet", "Sykkelen min ble stjålet", "Kjelleren fikk vannskade"];
const policyOptions: { label: string; value: PolicyId }[] = [
  { label: "Reise", value: "reise" }, { label: "Reise Pluss", value: "reisePluss" },
  { label: "Innbo", value: "innbo" }, { label: "Innbo Pluss", value: "innboPluss" },
];
const criticalityOptions: { value: BjarneCriticality; label: string }[] = [
  { value: "nice", label: "Snill" },
  { value: "neutral", label: "Nøytral" },
  { value: "critical", label: "Kritisk" },
];
const criticalityDescriptions: Record<BjarneCriticality, string> = {
  nice: "Bjarne later som han heier på deg. Han gjør det nok ikke.",
  neutral: "Bjarne holder det saklig mens han leter etter detaljer.",
  critical: "Bjarne mistenker hver kommafeil med full kaffemangel.",
};

type Exchange = { answer: string; response: Investigation };

function VerdictCard({ result }: { result: Investigation }) {
  const issue = result.status === "possible_rejection";
  const lost = result.status === "bjarne_lost";
  return (
    <Paper className={`reveal-card ${lost ? "reveal-lost" : issue ? "reveal-issue" : "reveal-unknown"}`} p={{ base: "lg", sm: "xl" }} radius="lg" role="status">
      <Text className="eyebrow">SAKEN ER FERDIG UNDERSØKT</Text>
      <Title order={2} mt="xs">{lost ? "Bjarne tapte 🎉" : issue ? "Bjarne fant noe 👀" : "Bjarne trenger mer 🤔"}</Title>
      <Text className="reveal-message" mt="md">{result.message}</Text>
      {issue && result.possibleIssue ? <Text className="issue-note" mt="md">{result.possibleIssue}</Text> : null}
      <Text mt="md">{result.reasoningSummary}</Text>
      <Text fw={700} mt="lg">{result.coverage === "possible_rejection" ? "Mulig grunnlag mot dekning" : result.coverage === "possibly_covered" ? "Ingen relevant avslagsgrunn funnet" : "Dekning uavklart"}</Text>
      {result.source ? <Text size="sm" mt="sm">Kilde: <a href={result.source.url} target="_blank" rel="noreferrer">{result.source.product}, {result.source.section}, PDF-side {result.source.page}</a>. {result.source.excerpt}</Text> : null}
      {result.escalation ? <Text c="dimmed" size="sm" mt="lg">Bjarnes rent fiktive nødeskalering: {result.escalation}</Text> : null}
      <Text c="dimmed" size="sm" mt="lg">Offentlige alminnelige vilkår er bare et oppslag. Dette er en leken vurdering, ikke en dekningsavgjørelse; den individuelle avtalen gjelder.</Text>
    </Paper>
  );
}

export function Avslagsgenerator() {
  const [claim, setClaim] = useState("");
  const [draft, setDraft] = useState("");
  const [policyId, setPolicyId] = useState<PolicyId>("innboPluss");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pendingText, setPendingText] = useState("");
  const [criticality, setCriticality] = useState<BjarneCriticality>("neutral");
  const bottomRef = useRef<HTMLDivElement>(null);
  const mutation = useMutation({
    mutationFn: ({ text, history, policy, tone }: { text: string; history: Turn[]; policy: PolicyId; tone: BjarneCriticality }) =>
      investigate(text, history, policy, tone),
  });
  const latest = exchanges.at(-1)?.response;
  const started = claim.length > 0;

  useEffect(() => {
    if (started) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges, pendingText, started]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || mutation.isPending || latest?.done) return;

    const history = started && latest ? [...turns, { question: latest.nextQuestion, answer: text }] : [];
    setPendingText(text);
    try {
      const result = await mutation.mutateAsync({ text: started ? claim : text, history, policy: policyId, tone: criticality });
      if (!started) setClaim(text);
      setTurns(history);
      setExchanges((previous) => [...previous, { answer: text, response: result }]);
      setDraft("");
    } catch {
      // Keep the draft for a retry; the mutation renders the error below the composer.
    } finally {
      setPendingText("");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function restart() {
    mutation.reset();
    setClaim("");
    setDraft("");
    setTurns([]);
    setExchanges([]);
    setPendingText("");
    setCriticality("neutral");
  }

  return (
    <main className="generator-shell">
      <Container size="md" py={{ base: 28, sm: 48 }}>
        <header className="generator-header">
          <Group gap="sm"><div className="bjarne-seal" aria-hidden="true">B</div><Text className="eyebrow">SKADEFRYD / BJARNES KONTOR</Text></Group>
          <Link to="/skadeorakelet" className="side-link">Prøv Skadeorakelet ↗</Link>
        </header>

        {!started && !pendingText ? (
          <section className="intro-block">
            <Badge color="yellow" variant="light" size="lg">EN HELT SERIØS U-SERIØS UNDERSØKELSE</Badge>
            <Title order={1}>Avslags<span>generatoren.</span></Title>
            <Text className="intro-lead">Bjarne har ett mål: finne en grunn til å si nei.</Text>
            <Text c="dimmed" className="intro-description">Fortell hva som skjedde. Bjarne stiller spørsmål til han finner noe som faktisk kan bety noe – eller må innrømme nederlag.</Text>
            <div className="intro-divider" />
          </section>
        ) : (
          <section className="conversation-heading">
            <Text className="eyebrow">SAKSNUMMER 001 · UNDER BEHANDLING</Text>
            <Group justify="space-between" align="end" gap="md">
              <Title order={1}>Bjarnes undersøkelse<span>.</span></Title>
              <Button onClick={restart} variant="subtle" color="gray" size="sm">Ny sak ↺</Button>
            </Group>
          </section>
        )}

        <div className="generator-grid">
          <section className="conversation-column" aria-label="Samtale med Bjarne">
            {!started && !pendingText ? <Paper p="md" radius="lg" mb="md"><Text fw={700} mb="xs">Hvilket vilkår skal Bjarne slå opp i?</Text><SegmentedControl fullWidth data={policyOptions} value={policyId} onChange={(value) => setPolicyId(value as PolicyId)} aria-label="Velg forsikringsprodukt" /><Text c="dimmed" size="xs" mt="xs">Offentlige alminnelige vilkår, ikke en individuell avtale.</Text></Paper> : <Text c="dimmed" size="sm" mb="sm">Oppslag: {policyOptions.find((option) => option.value === policyId)?.label}</Text>}
            {started || pendingText ? (
              <Stack gap="lg" className="conversation-log" aria-live="polite">
                {exchanges.map((exchange, index) => (
                  <div className="exchange" key={index}>
                    <div className="message-row message-row-user">
                      <div className="message-bubble user-bubble"><Text className="bubble-label">DU</Text><Text>{exchange.answer}</Text></div>
                    </div>
                    <div className="message-row">
                      <div className="avatar" aria-hidden="true">B</div>
                      <div className="message-bubble bjarne-bubble">
                        <Text className="bubble-label">BJARNE · SAKSBEHANDLER</Text>
                        <Text>{exchange.response.message}</Text>
                        {!exchange.response.done ? <Text className="bjarne-question" mt="sm">{exchange.response.nextQuestion}</Text> : null}
                      </div>
                    </div>
                  </div>
                ))}
                {pendingText ? (
                  <div className="exchange">
                    <div className="message-row message-row-user"><div className="message-bubble user-bubble"><Text className="bubble-label">DU</Text><Text>{pendingText}</Text></div></div>
                    <div className="message-row"><div className="avatar" aria-hidden="true">B</div><div className="message-bubble bjarne-bubble thinking-bubble"><span className="thinking-dots" aria-hidden="true">•••</span><Text>Bjarne leter febrilsk i papirene ...</Text></div></div>
                  </div>
                ) : null}
                {latest?.done ? <VerdictCard result={latest} /> : null}
                <div ref={bottomRef} />
              </Stack>
            ) : (
              <Paper className="welcome-card" p={{ base: "lg", sm: "xl" }} radius="lg">
                <div className="welcome-icon" aria-hidden="true">📋</div>
                <Text className="eyebrow">FØRSTE STEG</Text>
                <Title order={2} mt="xs">Hva har skjedd?</Title>
                <Text c="dimmed" mt="sm">Et par setninger holder. Du trenger ikke skrive en hel skademelding – det er det Bjarne som håper du gjør feil.</Text>
              </Paper>
            )}

            {!latest?.done ? (
              <form onSubmit={submit} className="composer">
                {!started ? (
                  <div className="criticality-picker">
                    <Text className="eyebrow">HVOR KRITISK ER BJARNE?</Text>
                    <SegmentedControl
                      fullWidth
                      mt="xs"
                      data={criticalityOptions}
                      value={criticality}
                      onChange={(value) => setCriticality(value as BjarneCriticality)}
                    />
                    <Text c="dimmed" size="xs" mt="xs">{criticalityDescriptions[criticality]}</Text>
                  </div>
                ) : null}
                <Textarea
                  aria-label={started ? "Svar på Bjarnes spørsmål" : "Hva har skjedd?"}
                  placeholder={started ? "Svar Bjarne med egne ord ..." : "F.eks. Jeg mistet mobilen i toalettet ..."}
                  minRows={started ? 2 : 4}
                  maxRows={8}
                  autosize
                  maxLength={1500}
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onKeyDown={onKeyDown}
                  disabled={mutation.isPending}
                />
                <Group justify="space-between" mt={started ? "md" : "lg"} gap="sm">
                  <Text c="dimmed" size="xs">Enter for å sende · Shift+Enter for ny linje</Text>
                  <Button type="submit" color="yellow" size="md" loading={mutation.isPending} disabled={!draft.trim()}>
                    {started ? "Send svar →" : "La Bjarne undersøke saken →"}
                  </Button>
                </Group>
                {mutation.isError ? <Alert color="red" title="Bjarne mistet tråden" mt="md">{mutation.error.message} Svaret ditt er fortsatt i feltet.</Alert> : null}
              </form>
            ) : <Button className="restart-button" onClick={restart} color="yellow" size="lg">Gi Bjarne en ny sak →</Button>}

            {!started && !pendingText ? <div className="examples"><Text className="eyebrow">TRENGER DU INSPIRASJON?</Text><Group gap="xs" mt="sm">{examples.map((example) => <button className="example-chip" key={example} onClick={() => setDraft(example)} type="button">{example} ↗</button>)}</Group></div> : null}
          </section>

          <aside className="case-sidebar" aria-label="Saksstatus">
            <Paper className="hope-card" p="lg" radius="lg">
              <Text className="eyebrow">BJARNES HÅP OM AVSLAG</Text>
              <Group align="baseline" gap={4} mt="sm"><span className="hope-number">{latest?.rejectionHope ?? 78}</span><span className="hope-percent">%</span></Group>
              <Progress value={latest?.rejectionHope ?? 78} color={latest?.done && latest.status === "bjarne_lost" ? "teal" : "yellow"} radius="xl" size="lg" mt="sm" animated={mutation.isPending} />
              <Text c="dimmed" size="xs" mt="sm">Kun Bjarnes optimisme. Ikke sannsynlighet for avslag.</Text>
            </Paper>
            <Paper className="case-status" p="lg" radius="lg" mt="md">
              <Text className="eyebrow">SAKSSTATUS</Text>
              <Text className="status-title" mt="sm">{latest?.done ? "Vurderingen er klar" : started ? "Bjarne undersøker" : "Venter på skademelding"}</Text>
              <Text c="dimmed" size="sm" mt="xs">{latest?.done ? "Se konklusjonen i samtalen." : started ? "Han har fortsatt noen paragrafer igjen å snu." : "Beskriv en oppdiktet hendelse for å begynne."}</Text>
              {latest?.relevantFacts.length ? <div className="fact-list"><Text className="eyebrow">DET VI VET</Text>{latest.relevantFacts.slice(0, 4).map((fact, index) => <Text size="sm" key={index}>↳ {fact}</Text>)}</div> : null}
            </Paper>
            <Text className="privacy-note">Bruk gjerne oppdiktede eksempler. Ikke del ekte personopplysninger.</Text>
          </aside>
        </div>
      </Container>
    </main>
  );
}
