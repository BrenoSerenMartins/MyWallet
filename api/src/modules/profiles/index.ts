import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../core/auth/index.js';
@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/me')
class ProfileController {
  @Get() me(@Req() request: AuthenticatedRequest) {
    return request.identity;
  }
}
@Module({ controllers: [ProfileController] })
export class ProfilesModule {}
