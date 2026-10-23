import type { SelectHTMLAttributes } from 'react';
import type { Category } from '../api/resources';
export function CategorySelect({
  categories,
  type,
  emptyLabel = 'Sem categoria',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  categories: Category[];
  type?: string;
  emptyLabel?: string;
}) {
  const available = categories.filter((c) => !type || c.type === type);
  const groups = [...new Set(available.map((c) => c.groupId ?? ''))];
  return (
    <select {...props}>
      <option value="">{emptyLabel}</option>
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
    </select>
  );
}
