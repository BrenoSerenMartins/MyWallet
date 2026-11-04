import { ApiProperty } from '@nestjs/swagger';
export class ManagedEntryDto {
  @ApiProperty({ type: Number }) refundedAmount!: number;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) transactionDate!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: String }) transactionType!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ nullable: true, type: String }) transferGroupId!: string | null;
  @ApiProperty({ nullable: true, type: String }) refundOfId!: string | null;
  @ApiProperty({ enum: ['card', 'investment'], nullable: true }) managedKind!:
    'card' | 'investment' | null;
}
