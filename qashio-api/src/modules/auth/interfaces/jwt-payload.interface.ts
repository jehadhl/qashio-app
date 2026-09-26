import { UserRole } from '@/modules/users/enums/user-role.enum';

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: TokenType;
  jti?: string;
}
