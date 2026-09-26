import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from '@/modules/categories/categories.controller';
import { CategoriesRepository } from '@/modules/categories/categories.repository';
import { CategoriesService } from '@/modules/categories/categories.service';
import { Category } from '@/modules/categories/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
