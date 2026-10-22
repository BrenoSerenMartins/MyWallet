import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
@Injectable()
export class Configuration {
  readonly port = Number(process.env.PORT ?? 8083);
  readonly supabaseUrl = process.env.SUPABASE_URL ?? '';
  readonly publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
  readonly databaseUrl = process.env.RUNTIME_DATABASE_URL ?? '';
  readonly ssl =
    process.env.NODE_ENV === 'test'
      ? false
      : {
          rejectUnauthorized: true,
          ca: readFileSync(
            process.env.DATABASE_CA_FILE ||
              new URL('../../../../infra/certificates/supabase-root-2021.crt', import.meta.url),
            'utf8',
          ),
        };
  constructor() {
    if (!this.supabaseUrl || !this.publishableKey)
      throw new Error('Supabase configuration is required.');
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535)
      throw new Error('Invalid PORT.');
  }
}
