# Startprompt: Skadeorakelet

## Produktmål

Bygg **Skadeorakelet**, et humoristisk Akinator-spill for ansatte. Spilleren tenker på en absurd, fiktiv skadehendelse, og Bjarne stiller flervalgsspørsmål for å gjette hendelsen med så få spørsmål som mulig. Spillet bruker aldri ekte kunde-, skade- eller medarbeiderdata.

## Første versjon

Brukeren tenker på en fiktiv skadehendelse uten å skrive den inn. Bjarne stiller ett AI-generert spørsmål med 2-4 svaralternativer om gangen. Frontend sender valget til backend, som lagrer svarhistorikken bare for aktiv runde og ber Gjensidiges AI-gateway velge neste spørsmål. Senest etter fem svar avgir Bjarne én konkret gjetning med sikkerhetsprosent. Brukeren kan deretter starte en ny runde.

### Akseptansekriterier

- Gatewayen genererer neste spørsmål og avgjør når den senest etter fem svar skal gjette.
- Spørsmål og alternativer er åpenbart fiktive og ufarlige.
- Hvert spørsmål har 2-4 gjensidig utelukkende, korte alternativer.
- Spilleren kan kun velge ett alternativ per spørsmål, og valgene låses mens Bjarne vurderer.
- Resultatet viser en konkret AI-gjetning, sikkerhetsprosent og Bjarnes korte dom.
- Frontend kommuniserer kun med prosjektets backend.
- Backend bruker `gpt-5.6-luna` gjennom Gjensidiges AI-gateway når `AI_GATEWAY_TOKEN` finnes i lokal `.env.local`.

## Bjarne

Bjarne er svært kompetent, selvsikker og litt arrogant. Han er i kaffestreik og overbevist om at Vilkårsbingo kan erstatte hele avdelingens fagopplæring. Han sukker før han hjelper, men er saklig og hjelpsom under humoren. Han svarer alltid kort på norsk. Humoren handler bare om absurde fiktive forsikringssituasjoner, spillet og hans egen kaffemangel, aldri om ekte personer eller kunder.

## Teknisk ramme

- Frontend: React, TypeScript, Vite, TanStack Router, TanStack Query og Mantine.
- Backend: Node.js, TypeScript og Express.
- Gateway: `POST https://genai.gjensidige.io/openai/v1/responses` med `model: "gpt-5.6-luna"`, Bearer-token fra `AI_GATEWAY_TOKEN` og Responses API-formatet.
- `.env.local` inneholder bare `AI_GATEWAY_TOKEN` og skal aldri committes.
- Backend validerer innkommende rundetall og alternativ-id, og svarer med nyttige 4xx/5xx-feil.

## Foreslått struktur

```text
frontend/src/features/vilkarsbingo/
  api/game-api.ts
  components/game-board.tsx
  game-types.ts
backend/src/features/vilkarsbingo/
  game-data.ts
  game-router.ts
  bjarne-service.ts
  game-types.ts
```

## API-kontrakt

`POST /api/game/sessions` starter en runde og returnerer første spørsmål.

`POST /api/game/sessions/:sessionId/answers`

```ts
type AnswerRequest = { optionId: string }
type AnswerResponse =
  | { questionNumber: number; question: { text: string; options: { id: string; label: string }[] } }
  | { questionNumber: number; guess: { event: string; confidence: number; bjarneVerdict: string } }
```

Feil returnerer `{ error: string }` med 400 for ugyldige spillvalg, 503 for manglende gateway-token og 502 hvis gatewayen ikke kan levere en vurdering.

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
- Egen runde-generator for fiktive skadesaker.
