import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, Length } from 'class-validator';
export class RecognitionSelectionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Length(64, 64, { each: true })
  signatures!: string[];
}
export class RecognitionChoiceDto {
  @ApiProperty({ type: String }) signature!: string;
  @ApiProperty({ type: String }) transactionId!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: String }) date!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String }) explanation!: string;
  @ApiProperty({ type: String, nullable: true }) counterpartyName!: string | null;
  @ApiProperty({ type: String, nullable: true }) categoryName!: string | null;
  @ApiProperty({ type: String, nullable: true }) cardName!: string | null;
  @ApiProperty({ type: String, nullable: true }) billMonth!: string | null;
}
export class RecognitionQueueDto {
  @ApiProperty({ type: [RecognitionChoiceDto] }) items!: RecognitionChoiceDto[];
  @ApiProperty({ type: Number }) scanned!: number;
}
export class RecognitionPreviewDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: [RecognitionChoiceDto] }) items!: RecognitionChoiceDto[];
}
