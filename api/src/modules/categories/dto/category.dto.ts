import { IsIn, IsString, Length, Matches, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CategoryGroupDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 80) @Matches(/\S/) name!: string;
  @ApiProperty({ enum: ['income', 'expense'] }) @IsIn(['income', 'expense']) type!: string;
  @ApiProperty({ type: String }) @Matches(/^#[0-9a-f]{6}$/i) color!: string;
}

export class CategoryDto extends CategoryGroupDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() groupId?:
    string | null;
}
