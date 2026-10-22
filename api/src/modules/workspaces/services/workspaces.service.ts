import { Inject, Injectable } from '@nestjs/common';
import { WorkspacesRepository } from '../repositories/workspaces.repository.js';
import type { CreateWorkspaceDto } from '../dto/workspace.dto.js';
@Injectable()
export class WorkspacesService {
  constructor(@Inject(WorkspacesRepository) private readonly repository: WorkspacesRepository) {}
  async list() {
    await this.repository.ensureDefault();
    return this.repository.list();
  }
  create(input: CreateWorkspaceDto) {
    return this.repository.create(input);
  }
}
