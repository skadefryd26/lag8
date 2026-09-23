import type { Investigation } from "../avslagsgenerator/investigation-api";

/** Avgjørelsen gjelder bare den oppdiktede AI-mot-AI-forestillingen. */
export function showcaseVerdict(result: Investigation) {
  if (result.status === "possible_rejection") {
    return {
      title: "AVSLÅTT",
      message: "*Sukk.* Denne oppdiktede saken avslås.",
      explanation: result.reasoningSummary,
    };
  }

  return {
    title: "GODKJENT",
    message: "*Sukk.* Jeg finner ingen dokumentert grunn til avslag. Denne oppdiktede saken godkjennes.",
    explanation: "Bjarne fant ikke et konkret unntak i vilkårene som begrunner avslag ut fra opplysningene som ble gitt.",
  };
}
