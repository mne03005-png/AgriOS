import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ReauthenticateDto } from './dto/reauthenticate.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiCreatedResponse({ description: '注册成功，返回 accessToken 和用户信息' })
  @ApiBadRequestResponse({ description: '账号已存在或请求参数错误' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOkResponse({ description: '登录成功，返回 accessToken 和用户信息' })
  @ApiUnauthorizedResponse({ description: '账号或密码错误' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOkResponse({ description: 'Refresh token rotated and a fresh token pair returned' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid, expired, or already rotated' })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOkResponse({ description: '当前用户、租户与角色' })
  @ApiUnauthorizedResponse({ description: '未登录或 token 无效' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: AuthenticatedRequest) {
    return this.authService.profile(req.user!.userId);
  }

  @ApiOkResponse({ description: '当前用户、租户与角色' })
  @ApiUnauthorizedResponse({ description: '未登录或 token 无效' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.profile(req.user!.userId);
  }

  @ApiOkResponse({ description: 'Password changed and a fresh accessToken is returned' })
  @ApiUnauthorizedResponse({ description: 'Current password is invalid or token is expired' })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user!.userId, dto);
  }

  @ApiOkResponse({ description: 'Logout audit event recorded' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user!.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reauthenticate')
  reauthenticate(@Req() req: AuthenticatedRequest, @Body() dto: ReauthenticateDto) {
    return this.authService.reauthenticate(req.user!.userId, dto);
  }
}
