import { Select } from './controls/select';
import type { SelectProps } from './controls/select';
import type { Category } from '../api/resources';
export function CategorySelect({
  categories,
  type,
  cardOptions = [],
  emptyLabel = 'Sem categoria',
  ...props
}: SelectProps & {
  cardOptions?: { id: string; name: string }[];
  categories: Category[];
  type?: string;
  emptyLabel?: string;
}) {
  const available = categories.filter((c) => !type || c.type === type);
  const groups = [...new Set(available.map((c) => c.groupId ?? ''))];
  return (
    <Select {...props}>
      <option value="">{emptyLabel}</option>
      {!!cardOptions.length && (
        <optgroup label="Cartões e faturas">
          {cardOptions.map((card) => (
            <option key={card.id} value={`card:${card.id}`}>
              {card.name}
            </option>
          ))}
        </optgroup>
      )}
      {groups.map((id) => (
        <optgroup
          key={id}
          label={available.find((c) => (c.groupId ?? '') === id)?.groupName ?? 'Sem grupo'}
        >
          {available
            .filter((c) => (c.groupId ?? '') === id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}
