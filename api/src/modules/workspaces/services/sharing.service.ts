import { Inject, Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { InviteDto } from '../dto/sharing.dto.js';
@Injectable()
export class SharingService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async members() {
    return this.db.query(
      'SELECT m.actor_id AS "actorId",m.role,(SELECT email FROM wallet.workspace_invites i WHERE i.workspace_id=m.workspace_id AND i.accepted_by=m.actor_id AND i.accepted_at IS NOT NULL ORDER BY i.accepted_at DESC LIMIT 1) AS email FROM wallet.workspace_members m WHERE m.workspace_id=wallet.current_workspace_id() ORDER BY m.created_at,m.actor_id',
    );
  }
  async invite(input: InviteDto) {
    this.db.requireOwner();
    const id = randomUUID(),
      token = randomBytes(32).toString('hex'),
      expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    await this.db.query(
      'INSERT INTO wallet.workspace_invites(id,workspace_id,email,role,token_hash,expires_at,created_by) VALUES($1,wallet.current_workspace_id(),$2,$3,$4,$5,$6)',
      [
        id,
        input.email.trim().toLowerCase(),
        input.role,
        createHash('sha256').update(token).digest('hex'),
        expiresAt,
        this.db.actorId,
      ],
    );
    return { id, token, expiresAt };
  }
  async invites() {
    this.db.requireOwner();
    return this.db.query(
      'SELECT id,email,role,expires_at AS "expiresAt",revoked_at AS "revokedAt",accepted_at AS "acceptedAt" FROM wallet.workspace_invites WHERE workspace_id=wallet.current_workspace_id() ORDER BY created_at DESC LIMIT 100',
    );
  }
  async revoke(id: string) {
    this.db.requireOwner();
    await this.db.query(
      'UPDATE wallet.workspace_invites SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE id=$1 AND workspace_id=wallet.current_workspace_id()',
      [id],
    );
    return { status: 'revoked' };
  }
  async change(actor: string, role?: string) {
    this.db.requireOwner();
    const [member] = await this.db.query(
      'SELECT role FROM wallet.workspace_members WHERE workspace_id=wallet.current_workspace_id() AND actor_id=$1 FOR UPDATE',
      [actor],
    );
    if (!member || member.role === 'owner')
      throw new ConflictException('O acesso do proprietário não pode ser alterado.');
    if (role)
      await this.db.query(
        'UPDATE wallet.workspace_members SET role=$2 WHERE workspace_id=wallet.current_workspace_id() AND actor_id=$1',
        [actor, role],
      );
    else
      await this.db.query(
        'DELETE FROM wallet.workspace_members WHERE workspace_id=wallet.current_workspace_id() AND actor_id=$1',
        [actor],
      );
    return { status: 'updated' };
  }
  async accept(token: string, email?: string) {
    if (!email) throw new BadRequestException('Confirme seu e-mail antes de aceitar o convite.');
    if (!/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Convite inválido.');
    try {
      const [r] = await this.db.query('SELECT wallet.accept_workspace_invite($1,$2) AS id', [
        createHash('sha256').update(token).digest('hex'),
        email,
      ]);
      return { id: r.id };
    } catch (e) {
      if ((e as { code?: string }).code === '22023')
        throw new BadRequestException('Convite inválido, expirado ou destinado a outro e-mail.');
      throw e;
    }
  }
}
