import { IsIn, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CategoryDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 80) name!: string;
  @ApiProperty({ enum: ['income', 'expense'] }) @IsIn(['income', 'expense']) type!: string;
  @ApiProperty({ type: String }) @Matches(/^#[0-9a-f]{6}$/i) color!: string;
}
