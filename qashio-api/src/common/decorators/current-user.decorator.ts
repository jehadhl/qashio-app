import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '@/modules/auth/interfaces/auth-user.interface';

// @CurrentUser() -> the whole user, @CurrentUser('id') -> one field.
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    // Never continue without a user: queries like { userId: undefined } match every row.
    if (!user) {
      throw new UnauthorizedException();
    }
    return field ? user[field] : user;
  },
);
