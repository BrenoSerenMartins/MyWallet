# Workspace permissions — design for next cycle

Status: design only. Runtime remains owner-only until a tested migration and access revision are shipped.

## Permission matrix

| Operation | Owner | Editor | Reader |
| --- | --- | --- | --- |
| Read financial data, source review and reports | Yes | Yes | Yes |
| Create/update transactions, plans, goals and agents | Yes | Yes | No |
| Confirm/reverse imports, card payments, financial adjustments | Yes | Yes | No |
| Financial CSV export and JSON backup | Yes | Yes | No |
| Restore a backup | Yes | No | No |
| Invite/remove members or change roles | Yes | No | No |
| Delete/restore workspace | Yes | No | No |
| Leave shared workspace | If another owner remains | Yes | Yes |
| Read/dismiss personal alerts | Own alerts | Own alerts | Own alerts |

Read-only means no writes through aliases, batch endpoints, idempotency receipts or GET-triggered materialization. Any endpoint currently creating bills/defaults on read must be reviewed before granting reader access.

## Identity model

Keep existing owner `user_id` as the financial namespace during compatibility migration. Add transaction-local actor and capabilities rather than blindly replacing every repository user filter. A verified actor may enter an active space only through active membership. Existing owners receive explicit owner membership with unchanged financial IDs. RLS uses namespace plus verified actor membership; audit records store actor separately. Do not trust client-provided owner, actor or role.

Use dedicated capabilities for export, restoration and membership, beyond read/write transaction selection. Read-only database transactions are a defense, not the sole role enforcement. Every unscoped workspace operation (listing, trash, defaults, invitations) needs an actor-aware rule separate from finance namespace.

Invite tokens are random, stored as hashes, expiring, revocable and consumed atomically. Acceptance requires the authenticated verified email matching the invitation. Existing membership is idempotent and never silently upgraded. No outbound email is assumed; the owner copies a link. Do not expose invite tokens in logs.

## Migration and revocation

- Add membership tables and authorization functions before exposing shared access.
- Backfill owners; prove unchanged owner-only behavior under restricted runtime role.
- Ensure namespace references are still enforced for each finance table.
- Membership check/lock and authorization run in the same transaction as financial writes.
- Revoke new access immediately; define in-flight transaction lock ordering to prevent stale role writes after revocation completes.
- Re-evaluate roles and invalidate financial caches after permission changes; server remains authoritative.
- Owner trash operations block all members; restoration preserves membership; final purge cascades memberships/invites and domain data.
- Backups contain domain content, not authority: restoring cannot create members, grant roles or trust source actors.

## Required proof before release

Tests under restricted runtime role for owner/editor/reader/nonmember, cross-space direct IDs, revoked/expired invites, last-owner constraints, role changes during writes, backup/export, batch import, trash and jobs. Use a real PostgreSQL integration environment as well as the existing PGlite suite for RLS and locking behavior. No sharing UI is shipped until the server matrix is complete.
