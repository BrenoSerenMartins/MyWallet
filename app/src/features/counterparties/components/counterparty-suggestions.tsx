import type { CounterpartyCandidate } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
const reasons = {
  name: 'Nome encontrado na descrição.',
  abbreviation: 'O nome parece abreviado na descrição.',
  similar_description: 'A descrição tem uma pequena diferença de escrita.',
};
export function CounterpartySuggestions({
  candidates,
  onSelect,
}: {
  candidates: CounterpartyCandidate[];
  onSelect: (id: string) => void;
}) {
  if (!candidates.length) return null;
  return (
    <div className="review-banner counterparty-suggestions" role="status">
      <div>
        <strong>
          {candidates.length === 1
            ? 'Possível pessoa ou estabelecimento'
            : 'Possíveis pessoas ou estabelecimentos'}
        </strong>
        <p>Confira antes de vincular. Nome parecido não confirma a identidade.</p>
        {candidates.map((candidate) => (
          <div className="counterparty-rule" key={candidate.counterpartyId}>
            <span>
              <strong>{candidate.name}</strong>
              <small>{reasons[candidate.reason]}</small>
            </span>
            <Button
              type="button"
              className="secondary compact"
              onClick={() => onSelect(candidate.counterpartyId)}
            >
              Vincular {candidate.name} e reconhecer esta descrição
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
