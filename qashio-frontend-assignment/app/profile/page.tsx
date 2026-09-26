// app/profile/page.tsx
'use client';

import { Alert, Box, Button, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useCurrentUser, useLogout } from '@/app/services/authService';
import UserAvatar, { userFullName } from '@/app/components/common/UserAvatar';
import { brandButtonSx } from '@/app/components/common/brand';

const Row = ({ label, value }: { label: string; value: string }) => (
  <Box sx={{ display: 'flex', py: 1.5, gap: 2 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
      {value}
    </Typography>
  </Box>
);

export default function ProfilePage() {
  const { data: user, isLoading, error } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 640 }}>
      <Box>
        <Typography variant="h4" component="h1">
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your account details
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error || !user ? (
        <Alert severity="error">Could not load your profile</Alert>
      ) : (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <UserAvatar user={user} size={64} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>
                {userFullName(user)}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            </Box>
          </Stack>

          <Divider />
          <Row label="First name" value={user.firstName} />
          <Row label="Last name" value={user.lastName} />
          <Row label="Email" value={user.email} />
          <Row label="Member since" value={new Date(user.createdAt).toLocaleDateString()} />
          <Divider sx={{ mb: 3 }} />

          <Button
            onClick={() => logout()}
            disabled={isLoggingOut}
            startIcon={isLoggingOut ? <CircularProgress size={16} color="inherit" /> : <LogoutIcon />}
            sx={brandButtonSx}
          >
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </Button>
        </Paper>
      )}
    </Box>
  );
}
