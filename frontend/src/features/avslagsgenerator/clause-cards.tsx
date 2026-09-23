import { Popover, Spoiler, Text, UnstyledButton } from "@mantine/core";
import type { CitedClause } from "./investigation-api";

const cleanTwist = (twist: string) => twist.replace(/^[«"]+|[»"]+$/g, "");
const sourceLabel = (clause: CitedClause) => `${clause.product} · s. ${clause.page}`;
/** PDF-teksten er brutt på fast linjebredde; slå sammen linjer som ikke starter et nytt punkt. */
const readable = (text: string) => text.replace(/\n(?![-•])/g, " ");

/** I Bjarnes boble: det han mener, stort. Kilden er en liten lapp man kan åpne. */
export function BjarneTwists({ clauses }: { clauses: CitedClause[] }) {
  if (!clauses.length) return null;
  return (
    <div className="twist-list">
      {clauses.map((clause) => (
        <figure className="twist" key={clause.id}>
          <blockquote className="twist-quote">«{cleanTwist(clause.bjarneTwist)}»</blockquote>
          <figcaption>
            <Popover width={360} position="bottom-start" shadow="md" withArrow>
              <Popover.Target>
                <UnstyledButton className="source-chip" aria-label={`Se hva ${sourceLabel(clause)} faktisk sier`}>
                  📎 {sourceLabel(clause)} · hva står det egentlig?
                </UnstyledButton>
              </Popover.Target>
              <Popover.Dropdown className="source-popover">
                <Text className="eyebrow">{sourceLabel(clause)} · ordrett</Text>
                <Text size="sm" mt={6} className="clause-quote">{readable(clause.text)}</Text>
              </Popover.Dropdown>
            </Popover>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** I sidefeltet: de ekte paragrafene, i liten skrift. */
export function ClauseSources({ clauses }: { clauses: CitedClause[] }) {
  if (!clauses.length) return null;
  return (
    <div className="source-list">
      <Text className="eyebrow">PARAGRAFENE BJARNE VRIR PÅ</Text>
      <Text c="dimmed" size="xs" mt={4}>Ordrett fra alminnelige vilkår. Tolkningen er Bjarnes egen.</Text>
      {clauses.map((clause) => (
        <div className="source-item" key={clause.id}>
          <Text size="xs" fw={700} c="yellow.3">📎 {sourceLabel(clause)}</Text>
          <Spoiler maxHeight={58} showLabel="Les mer" hideLabel="Vis mindre" classNames={{ control: "clause-toggle" }}>
            <Text size="xs" className="clause-quote">{readable(clause.text)}</Text>
          </Spoiler>
        </div>
      ))}
    </div>
  );
}
