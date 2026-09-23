# Vilkår for oppslag

Fire offentlig tilgjengelige **alminnelige vilkår** hentet fra Gjensidige 23.09.2026.
Bruk produktnavn og PDF-sidetall i kildehenvisninger; PDF-ene er ikke
individuelle forsikringsavtaler. Ikke bruk ekte kunde- eller skadedata ved testing.

| Lokal fil | Kilde |
| --- | --- |
| `reise.pdf` | https://www.gjensidige.no/files/privat/vilkar/reise/Reise-alminnelige-vilkar.pdf |
| `reise-pluss.pdf` | https://www.gjensidige.no/files/privat/vilkar/reise/Reise-Pluss-alminnelige-vilkar.pdf |
| `innbo.pdf` | https://www.gjensidige.no/files/privat/vilkar/bolig-innbo-og-verdier/Innbo-Standard-alminnelige%20vilkar.pdf |
| `innbo-pluss.pdf` | https://www.gjensidige.no/files/privat/vilkar/bolig-innbo-og-verdier/Innbo-Pluss-alminnelige-vilkar.pdf |

## Lokal database (RAG)

Bjarne slår opp i vilkårene via `src/features/vilkar/vilkar-db.ts`:

- PDF-ene trekkes ut til tekst og deles i utdrag på ca. 900 tegn (per PDF-side).
- Utdragene lagres i `vilkar.db` (SQLite), med to søk som flettes (Reciprocal Rank Fusion):
  - **vektorsøk** på betydning, med lokale embeddinger fra `multilingual-e5-small`
    (`src/features/vilkar/vilkar-embeddings.ts`). Modellen (~120 MB) lastes ned til
    `backend/.modeller/` første gang og kjører på maskinen – ingenting sendes ut.
  - **FTS5 fulltekstsøk** (BM25) på eksakte ord, som fanger begreper som «FG-godkjent».
- Filen er ignorert av Git og bygges automatisk første gang backend søker (tar under ett minutt),
  og på nytt når en PDF eller embeddingmodellen endres. Uten modell faller søket tilbake til bare ord.
- `tekst/*.md` er den samme teksten i lesbar form, for å se hva Bjarne faktisk har å gå på.

Kommandoer (fra `backend/`):

```
npm run vilkar -- bygg                 # bygg vilkar.db og tekst/*.md på nytt
npm run vilkar -- sok "mistet mobilen"  # se hvilke utdrag Bjarne ville fått
```

Nye vilkår: legg PDF-en her, legg den til i `products` i `vilkar-db.ts`, og kjør `bygg`.
Modellen får bare velge utdrag via ID; teksten som vises i appen kommer alltid fra databasen.
