// components/common/UserAvatar.tsx
'use client';

import { Avatar, AvatarProps } from '@mui/material';
import { User } from '@/app/types';
import { BRAND } from './brand';

export const userInitials = (user?: Pick<User, 'firstName' | 'lastName'> | null) =>
  user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';

export const userFullName = (user?: Pick<User, 'firstName' | 'lastName'> | null) =>
  user ? `${user.firstName} ${user.lastName}` : '';

// Initials on the brand colour; a plain person icon while the user is loading.
export default function UserAvatar({
  user,
  size = 36,
  sx,
  ...props
}: AvatarProps & { user?: User | null; size?: number }) {
  return (
    <Avatar
      alt={userFullName(user)}
      {...props}
      sx={{ width: size, height: size, bgcolor: BRAND.main, fontSize: size * 0.4, fontWeight: 600, ...sx }}
    >
      {userInitials(user) || undefined}
    </Avatar>
  );
}
