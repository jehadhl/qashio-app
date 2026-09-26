// components/common/brand.ts - the gold accent used by the sidebar, auth pages and main buttons.
export const BRAND = {
  main: '#a78f65',
  dark: '#9a7d58',
  soft: 'rgba(167, 143, 101, 0.10)',
  softer: 'rgba(167, 143, 101, 0.06)',
} as const;

export const brandButtonSx = {
  bgcolor: BRAND.main,
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: BRAND.dark, boxShadow: 'none' },
} as const;
