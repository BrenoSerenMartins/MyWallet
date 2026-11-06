import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Length } from 'class-validator';
export class InviteDto {
  @ApiProperty({ type: String }) @IsEmail() email!: string;
  @ApiProperty({ enum: ['editor', 'reader'] }) @IsIn(['editor', 'reader']) role!:
    'editor' | 'reader';
}
export class MemberRoleDto {
  @ApiProperty({ enum: ['editor', 'reader'] }) @IsIn(['editor', 'reader']) role!:
    'editor' | 'reader';
}
export class AcceptInviteDto {
  @ApiProperty({ type: String }) @IsString() @Length(64, 64) token!: string;
}
export class MemberDto {
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String }) actorId!: string;
  @ApiProperty({ enum: ['owner', 'editor', 'reader'] }) role!: string;
}
export class InviteResultDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) token!: string;
  @ApiProperty({ type: String }) expiresAt!: string;
}
