// components/common/PageLayout.tsx
'use client';

import { Container, Box } from '@mui/material';
import NavBar from './NavBar';
import Sidebar from './Sidebar';
import Toaster from './Toaster';
import { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
   
      <Sidebar />
      
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <NavBar />
        
        <Container 
          component="main" 
          maxWidth={false}
          sx={{ 
            mt: 3, 
            mb: 3,
            flexGrow: 1,
            px: 4,
          }}
        >
          {children}
        </Container>
      </Box>

      <Toaster />
    </Box>
  );
}