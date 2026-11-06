import { Module } from '@nestjs/common';
import { AlertsController } from './controllers/alerts.controller.js';
import { AlertsService } from './services/alerts.service.js';
@Module({ controllers: [AlertsController], providers: [AlertsService] })
export class AlertsModule {}
