import { UserRole } from '@/modules/users/enums/user-role.enum';


export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
