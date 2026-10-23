import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/auth-provider';
import { request, jsonBody } from '../../../shared/api/client';
import type { Category, CategoryGroup } from '../../../shared/api/resources';
export function useCategories() {
  const { session } = useAuth();
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: [session?.user.id, 'categories'],
    queryFn: () => request<Category[]>('/categories'),
  });
  const groups = useQuery({
    queryKey: [session?.user.id, 'category-groups'],
    queryFn: () => request<CategoryGroup[]>('/category-groups'),
  });
  async function save(
    kind: 'group' | 'category',
    input: { name: string; type: string; color: string; groupId?: string | null },
    id?: string,
  ) {
    const path = kind === 'group' ? '/category-groups' : '/categories';
    await request(path + (id ? '/' + id : ''), {
      method: id ? 'PATCH' : 'POST',
      body: jsonBody(input),
    });
    await client.invalidateQueries();
  }
  async function deleteGroup(id: string) {
    await request(`/category-groups/${id}`, { method: 'DELETE' });
    await client.invalidateQueries();
  }
  return { categories, groups, save, deleteGroup };
}
