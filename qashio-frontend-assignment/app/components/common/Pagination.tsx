'use client';

import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
        px: 2,
        borderTop: '1px solid #e0e0e0',
        bgcolor: '#f9f9f9',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Showing {startItem} to {endItem} of {total} transactions
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          size="small"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          sx={{
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        <Typography variant="body2" sx={{ px: 1.5 }}>
          Page {currentPage} of {totalPages}
        </Typography>

        <IconButton
          size="small"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          sx={{
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}