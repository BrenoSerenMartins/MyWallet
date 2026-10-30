import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspacesRepository } from '../repositories/workspaces.repository.js';
import type { CreateWorkspaceDto } from '../dto/workspace.dto.js';
@Injectable()
export class WorkspacesService {
  constructor(@Inject(WorkspacesRepository) private readonly repository: WorkspacesRepository) {}
  async list() {
    await this.repository.lockOwner();
    await this.repository.purgeExpired();
    await this.repository.ensureDefault();
    return this.repository.list();
  }
  async trash() {
    await this.repository.lockOwner();
    await this.repository.purgeExpired();
    return this.repository.trash();
  }
  async archive(id: string) {
    await this.repository.lockOwner();
    if (!(await this.repository.lock(id))) throw new NotFoundException('Espaço não encontrado.');
    const workspace = await this.repository.archive(id);
    if (!workspace) throw new NotFoundException('O prazo de restauração deste espaço terminou.');
    return workspace;
  }
  async restore(id: string) {
    await this.repository.lockOwner();
    const workspace = await this.repository.lock(id);
    if (!workspace) throw new NotFoundException('Espaço não encontrado.');
    if (workspace.deleted_at === null)
      return (await this.repository.list()).find((item) => item.id === id)!;
    const restored = await this.repository.restore(id);
    if (!restored) throw new NotFoundException('O prazo de restauração deste espaço terminou.');
    return restored;
  }
  create(input: CreateWorkspaceDto) {
    return this.repository.create(input);
  }
}
