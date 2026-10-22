import { WorkspacesModule } from './modules/workspaces/index.js';
import { ProfilesModule } from './modules/profiles/index.js';
import { DataExportModule } from './modules/data-export/index.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './core/database/index.js';
import { AuthModule } from './core/auth/index.js';
import { HealthModule } from './modules/health/index.js';
import { IntegrationModule } from './composition/integration.module.js';
import { ImportsModule } from './modules/imports/index.js';
import { DashboardModule } from './modules/dashboard/index.js';
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    IntegrationModule,
    ImportsModule,
    DashboardModule,
    DataExportModule,
    ProfilesModule,
    WorkspacesModule,
  ],
})
export class AppModule {}
