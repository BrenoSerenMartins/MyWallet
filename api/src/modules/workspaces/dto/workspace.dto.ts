import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, MaxLength, Matches } from 'class-validator';
export class CreateWorkspaceDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 80) @Matches(/\S/) name!: string;
  @ApiProperty({ type: String }) @IsString() @MaxLength(240) description!: string;
  @ApiProperty({ type: String, enum: ['emerald', 'blue', 'violet', 'amber', 'rose'] })
  @IsIn(['emerald', 'blue', 'violet', 'amber', 'rose'])
  color!: string;
}
export class WorkspaceResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: String }) color!: string;
  @ApiProperty({ type: Boolean }) isDefault!: boolean;
}
