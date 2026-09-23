# Startprompt: Avslagsgeneratoren

## Produktmål

Bygg **Avslagsgeneratoren**, en humoristisk samtale for ansatte. Brukeren beskriver en absurd, fiktiv skade, og Bjarne undersøker den med oppfølgingsspørsmål mens han håper på en grunn til å avslå. Appen bruker aldri ekte kunde-, skade- eller medarbeiderdata.

## Første versjon

Brukeren beskriver en fiktiv skadehendelse og velger om Bjarne skal være snill, nøytral eller kritisk. Bjarne stiller ett oppfølgingsspørsmål om gangen i en samtale, og frontend sender svaret og den valgte tonen til backend. Backend bruker tonen når den ber Gjensidiges AI-gateway velge neste spørsmål og vurdering. Etter nok opplysninger, og senest etter seks svar, viser Bjarne en leken, begrunnet vurdering. Brukeren kan deretter starte en ny sak.

### Akseptansekriterier

- Brukeren kan velge Bjarnes kritikalitet før saken starter, og gatewayen holder den valgte tonen uten å bli ufin.
- Gatewayen genererer neste spørsmål og avgjør når den senest etter seks svar skal konkludere.
- Spørsmålene og vurderingen er åpenbart fiktive, ufarlige og uten juridiske løfter.
- Brukeren svarer med egne ord på ett konkret oppfølgingsspørsmål om gangen, og feltet låses mens Bjarne vurderer.
- Resultatet viser en kort, begrunnet og leken vurdering, med eventuell usikkerhet tydelig forklart.
- Frontend kommuniserer kun med prosjektets backend.
- Backend bruker `gpt-5.6-luna` gjennom Gjensidiges AI-gateway når `AI_GATEWAY_TOKEN` finnes i lokal `.env.local`.

## Bjarne

Bjarne er svært kompetent, selvsikker og litt arrogant. Han er i kaffestreik og overbevist om at han kan avslå nesten alt. Han sukker før han hjelper, men er saklig og hjelpsom under humoren. Han svarer alltid kort på norsk. Humoren handler bare om absurde fiktive forsikringssituasjoner, spillet og hans egen kaffemangel, aldri om ekte personer eller kunder.

## Teknisk ramme

- Frontend: React, TypeScript, Vite, TanStack Router, TanStack Query og Mantine.
- Backend: Node.js, TypeScript og Express.
- Gateway: `POST https://genai.gjensidige.io/openai/v1/responses` med `model: "gpt-5.6-luna"`, Bearer-token fra `AI_GATEWAY_TOKEN` og Responses API-formatet.
- `.env.local` inneholder bare `AI_GATEWAY_TOKEN` og skal aldri committes.
- Backend validerer innkommende rundetall og alternativ-id, og svarer med nyttige 4xx/5xx-feil.

## Foreslått struktur

```text
frontend/src/features/avslagsgenerator/
  avslagsgenerator.tsx
  investigation-api.ts
backend/src/features/avslagsgenerator/
  investigation-router.ts
  investigation.ts
```

## API-kontrakt

`POST /api/avslagsgenerator/investigate` vurderer en skademelding eller et svar i den aktive samtalen.

```ts
type InvestigationRequest = {
  claim: string;
  turns: { question: string; answer: string }[];
  criticality: "nice" | "neutral" | "critical";
};
```

Feil returnerer `{ error: string }` med 400 for ugyldige meldinger eller kritikalitet og 502 hvis gatewayen ikke kan levere en vurdering.

## Lokal oppstart og validering

- `npm install`
- Hent gateway-token med Azure CLI til lokal `.env.local`.
- `npm run dev` starter frontend og backend.
- `npm run check` typechecker prosjektet.
- Verifiser første skjerm i en nettleser med `node scripts/sjekk-appen.mjs <faktisk-url>`.

## Senere utvidelser

- Kontorliga og lokal toppliste.
- Flere AI-dommere som krangler med Bjarne.
- Lyd, konfetti og eskalerende kaffemåler.
- Egen generator for fiktive skadesaker.

## Utvidelse: Sjefsagenten

Når Bjarne ikke finner noen konkret mulig avslagsgrunn (`bjarne_lost`), eskaleres den fiktive saken automatisk til en egen, streng AI-sjef. Brukeren kan også be om sjefen etter et av Bjarnes svar, uten å vente på konklusjonen. Sjefen leser den oppgitte saken, samtalen og Bjarnes siste vurdering, og gir en separat, kort og kritisk vurdering på norsk. Granskingen er humoristisk, men sjefen dikter ikke opp kriminalitet, mistenkelige venner, vilkår eller fakta. Manglende opplysninger kan etterspørres, ikke fremstilles som bevis. Frontend viser venting, resultat og en mulighet til å prøve igjen dersom sjefen ikke svarer.

Når sjefen blir bedt om å vurdere en sak underveis, kan brukeren fortsette å skrive til Bjarne mens sjefen tenker, og sende svaret når sjefen er ferdig. Sjefens svar blir liggende ved riktig sted i samtalen; det avslutter ikke Bjarnes spørsmål. Først Bjarnes egen konklusjon avslutter inndatafeltet.

`POST /api/avslagsgenerator/escalate` tar `{ claim, turns, bjarne: { message, status, reasoningSummary } }` og returnerer `{ message, scrutiny, conclusion }`, der `conclusion` er `possible_issue`, `nothing_found` eller `needs_information`. Ugyldig input gir 400; utilgjengelig eller ugyldig gateway-svar gir 502.
