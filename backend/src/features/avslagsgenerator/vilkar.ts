// Korte, kontrollerte utdrag fra Gjensidiges offentlige alminnelige vilkår.
// PDF-sidetall (ikke trykte sidetall). Oppdater utdragene hvis kildene endres.
export const policies = {
  reise: { label: "Reise", url: "https://www.gjensidige.no/files/privat/vilkar/reise/Reise-alminnelige-vilkar.pdf" },
  reisePluss: { label: "Reise Pluss", url: "https://www.gjensidige.no/files/privat/vilkar/reise/Reise-Pluss-alminnelige-vilkar.pdf" },
  innbo: { label: "Innbo", url: "https://www.gjensidige.no/files/privat/vilkar/bolig-innbo-og-verdier/Innbo-Standard-alminnelige%20vilkar.pdf" },
  innboPluss: { label: "Innbo Pluss", url: "https://www.gjensidige.no/files/privat/vilkar/bolig-innbo-og-verdier/Innbo-Pluss-alminnelige-vilkar.pdf" },
} as const;

export type PolicyId = keyof typeof policies;
export function isPolicyId(value: unknown): value is PolicyId {
  return typeof value === "string" && Object.hasOwn(policies, value);
}

export type Clause = { id: string; page: number; section: string; text: string };
const reise = (plus: boolean): Clause[] => [
  { id: "reise-omfang", page: 3, section: "Hvor gjelder forsikringen?", text: "På reiser i hele verden, som starter og slutter på bostedsadressen i Norge. Ikke på bostedsadressen eller fast arbeids-/studiested." },
  { id: "reise-gods", page: 5, section: "Reisegods", text: "Tyveri, ran, brann, vannledningsskade og skadet innsjekket bagasje kan dekkes. Reisegods som mistes eller kommer bort dekkes ikke; egen sykkel skadet eller stjålet i Norge dekkes ikke." },
  { id: "reise-mobil", page: 6, section: "Mobiltelefon", text: "På reise dekkes knust skjerm og tyveri/ran/brann. Mobiltelefon som mistes eller kommer bort og andre skader enn de som er nevnt, dekkes ikke." },
  { id: "reise-forsinkelse", page: 6, section: "Forsinkelser", text: "Forsinket ekspedert bagasje kan gi dekning for nødvendige innkjøp. Transportforsinkelse på minst 1,5 time pga. vær eller teknisk feil kan gi dekning; personellmangel dekkes ikke." },
  { id: "reise-avbestilling", page: 7, section: "Avbestilling", text: "Avbestilling ved uventet akutt sykdom eller skade kan dekkes når dette dokumenteres. Planlagt behandling og reiser betalt med bonuspoeng dekkes ikke." },
  { id: "reise-sikring", page: 2, section: "Sikkerhetsforskrifter", text: "Reisegods skal ikke etterlates uten tilsyn. Sykkel skal være låst fast eller innelåst. Brudd kan føre til helt eller delvis bortfall etter konkret vurdering." },
  { id: "reise-svik", page: plus ? 17 : 14, section: "Generelle vilkår, 16. Svik", text: "Ved svik opphører retten til erstatning. Dette krever faktisk grunnlag for svik; en mistanke alene er ikke nok." },
  ...(plus ? [{ id: "reise-leiebil", page: 8, section: "Leiebil/-motorsykkel", text: "Egenandelskrav ved skade eller tyveri av leid bil på feriereise med minst én overnatting kan dekkes hvis bilen er kaskoforsikret; privat leie og bildeling i Norge er unntatt." }] : []),
];
const innbo = (plus: boolean): Clause[] => [
  { id: "innbo-omfang", page: 3, section: "Hvem og hvor gjelder forsikringen?", text: "Innbo i bolig angitt i forsikringsbeviset omfattes; midlertidig bortebevart innbo omfattes i Norden. Bokollektiv og leietakere er ikke medforsikret." },
  { id: "innbo-tyveri", page: 3, section: "Hvilke skader?", text: "Brann, plutselig vannskade og tyveri av innbo kan dekkes. Ting som er mistet, tapt eller har ukjent skadeårsak dekkes ikke." },
  { id: "innbo-vann", page: 3, section: "Hvilke skader? Vann", text: "Lekkasje fra rør, installasjoner og akvarium kan dekkes. Søl som pågår over tid, kondens, sopp og råte dekkes ikke." },
  { id: "innbo-sykkel", page: 1, section: "Sikkerhetsforskrifter", text: "Sykkel skal være låst fast eller innelåst. For sykkel med verdi over 15 000 kr kreves FG-godkjent lås. Brudd kan føre til helt eller delvis bortfall etter konkret vurdering." },
  { id: "innbo-dyr", page: 3, section: "Hvilke skader?", text: plus ? "Standarddekningen unntar kjæledyrskader; uhellsdekningen på side 4 unntar også skade forårsaket av kjæledyr." : "Standarddekningen unntar skade som skyldes kjæledyr." },
  { id: "innbo-svik", page: plus ? 13 : 11, section: "Generelle vilkår, 16. Svik", text: "Ved svik opphører retten til erstatning. Dette krever faktisk grunnlag for svik; en mistanke alene er ikke nok." },
  ...(plus ? [
    { id: "innbo-uhell", page: 4, section: "Uhell hjemme og borte", text: "Plutselig og uforutsett ytre hendelse som skader ting hjemme eller ute i verden kan dekkes; uhell borte er begrenset til 30 000 kr." },
    { id: "innbo-mobil", page: 4, section: "Mobilforsikring – knust skjerm", text: "Bytte av knust skjerm/deksel kan dekkes. Andre skader enn knust skjerm vurderes under uhellsdekningen, ikke skjermdekningen." },
  ] : []),
];

export function clausesFor(policyId: PolicyId): Clause[] {
  switch (policyId) {
    case "reise": return reise(false);
    case "reisePluss": return reise(true);
    case "innbo": return innbo(false);
    case "innboPluss": return innbo(true);
  }
}

export function sourceFor(policyId: PolicyId, id: string) {
  const clause = clausesFor(policyId).find((entry) => entry.id === id);
  return clause ? { product: policies[policyId].label, url: `${policies[policyId].url}#page=${clause.page}`, page: clause.page, section: clause.section, excerpt: clause.text } : null;
}
