// components/common/NavBar.tsx
'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import {
  AppBar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useCurrentUser, useLogout } from '@/app/services/authService';
import UserAvatar, { userFullName } from './UserAvatar';
import { BRAND, brandButtonSx } from './brand';

const DANGER = '#d32f2f';

// One row of the account menu: tinted icon tile, title + hint, chevron.
function AccountMenuItem({
  icon,
  title,
  hint,
  danger,
  ...props
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  danger?: boolean;
} & React.ComponentProps<typeof MenuItem> & { href?: string; component?: React.ElementType }) {
  const color = danger ? DANGER : BRAND.main;
  return (
    <MenuItem
      {...props}
      sx={{
        gap: 1.5,
        px: 1.25,
        py: 1,
        borderRadius: 2,
        '&:hover': { bgcolor: danger ? 'rgba(211, 47, 47, 0.06)' : BRAND.softer },
        '&:hover .menu-chevron': { opacity: 1, transform: 'translateX(0)' },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color,
          bgcolor: danger ? 'rgba(211, 47, 47, 0.08)' : BRAND.soft,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: danger ? DANGER : 'text.primary' }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {hint}
        </Typography>
      </Box>
      <ChevronRightIcon
        className="menu-chevron"
        fontSize="small"
        sx={{ color: 'text.disabled', opacity: 0, transform: 'translateX(-4px)', transition: 'all 0.15s ease' }}
      />
    </MenuItem>
  );
}

export default function NavBar() {
  const { data: user } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const closeMenu = () => setMenuAnchor(null);
  const open = !!menuAnchor;

  return (
    <AppBar
      position="static"
      sx={{
        bgcolor: '#ffffff',
        color: '#000',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'flex-end', gap: 2 }}>
        <Button component={Link} href="/transactions/new" sx={{ ...brandButtonSx, fontSize: '0.85rem', px: 2 }}>
          + New Transaction
        </Button>

        {/* Account trigger: avatar + name, like a profile pill */}
        <ButtonBase
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          aria-label="Open account menu"
          aria-controls={open ? 'account-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            gap: 1,
            pl: 0.5,
            pr: 1,
            py: 0.5,
            borderRadius: 999,
            border: '1px solid',
            borderColor: open ? BRAND.main : '#e8e8e8',
            bgcolor: open ? BRAND.softer : 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: BRAND.softer, borderColor: BRAND.main },
          }}
        >
          <UserAvatar user={user} size={32} />
          {user && (
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' }, maxWidth: 140 }}
              noWrap
            >
              {user.firstName}
            </Typography>
          )}
          <KeyboardArrowDownIcon
            fontSize="small"
            sx={{ color: 'text.secondary', transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </ButtonBase>

        <Menu
          id="account-menu"
          anchorEl={menuAnchor}
          open={open}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: 1.5,
                width: 290,
                borderRadius: 3,
                border: '1px solid #eee',
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
                overflow: 'visible',
              },
            },
            list: { sx: { p: 1 } },
          }}
        >
          {/* Profile card */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              mb: 1,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${BRAND.soft} 0%, ${BRAND.softer} 100%)`,
            }}
          >
            <UserAvatar user={user} size={46} sx={{ boxShadow: '0 0 0 3px #fff' }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
                {userFullName(user) || 'Your account'}
              </Typography>
              {user && (
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {user.email}
                </Typography>
              )}
              {user && (
                <Chip
                  label={user.role === 'admin' ? 'Admin' : 'Member'}
                  size="small"
                  sx={{
                    mt: 0.5,
                    height: 20,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: BRAND.dark,
                    bgcolor: '#fff',
                    border: `1px solid ${BRAND.soft}`,
                  }}
                />
              )}
            </Box>
          </Box>

          <AccountMenuItem
            component={Link}
            href="/profile"
            onClick={closeMenu}
            icon={<PersonOutlineIcon fontSize="small" />}
            title="Profile"
            hint="View your account details"
          />

          <Divider sx={{ my: 1 }} />

          <AccountMenuItem
            danger
            disabled={isLoggingOut}
            onClick={() => {
              closeMenu();
              logout();
            }}
            icon={<LogoutIcon fontSize="small" />}
            title={isLoggingOut ? 'Logging out...' : 'Log out'}
            hint="Sign out of this device"
          />
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
