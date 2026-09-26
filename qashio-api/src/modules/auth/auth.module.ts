import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import jwtConfig from '@/core/config/jwt.config';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({ secret: jwt.secret }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
