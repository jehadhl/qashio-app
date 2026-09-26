import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '@/common/decorators/transform.decorators';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Groceries', maxLength: 50 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}