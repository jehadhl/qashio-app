// components/common/Sidebar.tsx
"use client";

import {
  Drawer,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  SwapHoriz as TransactionsIcon,
  PersonOutline as ProfileIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser, useLogout } from "@/app/services/authService";
import UserAvatar, { userFullName } from "./UserAvatar";
import { BRAND } from "./brand";

const DRAWER_WIDTH = 250;
const HEADER_HEIGHT = 64;

const NAV_ITEMS = [
  { href: "/transactions", label: "Transactions", icon: <TransactionsIcon /> },
  { href: "/profile", label: "Profile", icon: <ProfileIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          borderRight: "1px solid #e0e0e0",
        },
      }}
    >
      <Box
        sx={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          px: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            fontSize: "1rem",
          }}
        >
          Qashio
        </Typography>
      </Box>

      {/* Navigation */}
      <List sx={{ p: 2 }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <ListItemButton
              key={href}
              component={Link}
              href={href}
              selected={active}
              sx={{
                bgcolor: active ? BRAND.main : "transparent",
                color: active ? "#fff" : "#666",
                borderRadius: "6px",
                mb: 1,
                "&.Mui-selected": {
                  bgcolor: BRAND.main,
                  color: "#fff",
                  "&:hover": {
                    bgcolor: BRAND.dark,
                  },
                },
                "&:hover": {
                  bgcolor: active ? BRAND.dark : "#f0f0f0",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: "inherit",
                  minWidth: 40,
                }}
              >
                {icon}
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>

      {/* Signed-in user, pinned to the bottom */}
      <Box sx={{ mt: "auto" }}>
        <Divider />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
          <UserAvatar user={user} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {userFullName(user) || "Account"}
            </Typography>
            {user && (
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {user.email}
              </Typography>
            )}
          </Box>
          <Tooltip title="Log out">
            <span>
              <IconButton
                size="small"
                aria-label="Log out"
                onClick={() => logout()}
                disabled={isLoggingOut}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Drawer>
  );
}
