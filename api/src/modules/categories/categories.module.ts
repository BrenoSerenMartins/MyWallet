import { CategoryGroupsController } from './controllers/category-groups.controller.js';
import { Module } from '@nestjs/common';
import { CategoriesController } from './controllers/categories.controller.js';
import { CategoriesService } from './services/categories.service.js';
import { CategoriesRepository } from './repositories/categories.repository.js';
@Module({
  controllers: [CategoriesController, CategoryGroupsController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
