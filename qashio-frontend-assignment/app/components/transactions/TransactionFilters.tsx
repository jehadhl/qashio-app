// components/transactions/TransactionFilters.tsx
'use client';

import {
  Box,
  TextField,
  MenuItem,
  Select,
  FormControl,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useEffect, useState } from 'react';
import {
  DatePreset,
  hasActiveFilters as getHasActiveFilters,
  StatusFilter,
  TypeFilter,
  useTransactionStore,
} from '@/app/hooks/useTransactionStore';
import { useDebounce } from '@/app/hooks/useDebounce';
import { useCategories } from '@/app/services/categoryService';

const selectSx = {
  height: '40px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  bgcolor: '#fff',
  fontSize: '0.9rem',
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiSelect-select': {
    py: 0.8,
    px: 1.2,
  },
} as const;

export default function TransactionFilters() {
  const filters = useTransactionStore((state) => state.filters);
  const setFilters = useTransactionStore((state) => state.setFilters);
  const resetFilters = useTransactionStore((state) => state.resetFilters);
  const { data: categories = [] } = useCategories();

  // Local copy of the search box so keystrokes feel instant; the debounced value is what
  // actually reaches the store (and from there, the URL + fetch) once typing pauses.
  const [searchInput, setSearchInput] = useState(filters.searchTerm);
  const debouncedSearch = useDebounce(searchInput, 400);

  // Keep the local box in sync when filters are reset/hydrated from the URL elsewhere.
  useEffect(() => {
    setSearchInput(filters.searchTerm);
  }, [filters.searchTerm]);

  // Fires once the user has stopped typing for 400ms.
  useEffect(() => {
    if (debouncedSearch === filters.searchTerm) return;
    setFilters({ searchTerm: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasActiveFilters = getHasActiveFilters(filters);

  // Nothing to choose from until the user creates a category; keep it visible if the
  // URL already filters by one, so that filter can still be seen and cleared.
  const showCategoryFilter = categories.length > 0 || !!filters.category;

  return (
    <Box>
      {/* Filter Row */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #ddd',
            borderRadius: '4px',
            px: 1.2,
            py: 0.8,
            bgcolor: '#fff',
            width: '250px',
            height: '40px',
            boxSizing: 'border-box',
          }}
        >
          <TextField
            placeholder="Search reference or counterparty..."
            variant="standard"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              disableUnderline: true,
            }}
            sx={{
              flex: 1,
              '& .MuiInputBase-input': {
                fontSize: '0.9rem',
                padding: 0,
              },
              '& .MuiInputBase-input::placeholder': {
                opacity: 0.7,
              },
            }}
          />
          <SearchIcon sx={{ color: '#999', fontSize: '1.1rem' }} />
        </Box>

        {/* Date Filter */}
        <FormControl size="small" sx={{ minWidth: '140px', height: '40px' }}>
          <Select
            value={filters.datePreset}
            onChange={(e) => setFilters({ datePreset: e.target.value as DatePreset })}
            displayEmpty
            IconComponent={KeyboardArrowDownIcon}
            sx={selectSx}
          >
            <MenuItem value="">Date</MenuItem>
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="week">This Week</MenuItem>
            <MenuItem value="month">This Month</MenuItem>
          </Select>
        </FormControl>

        {/* Status Filter */}
        <FormControl size="small" sx={{ minWidth: '140px', height: '40px' }}>
          <Select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as StatusFilter })}
            displayEmpty
            IconComponent={KeyboardArrowDownIcon}
            sx={selectSx}
          >
            <MenuItem value="">Status</MenuItem>
            <MenuItem value="Completed">Completed</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Failed">Failed</MenuItem>
          </Select>
        </FormControl>

        {/* Type Filter */}
        <FormControl size="small" sx={{ minWidth: '130px', height: '40px' }}>
          <Select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value as TypeFilter })}
            displayEmpty
            IconComponent={KeyboardArrowDownIcon}
            sx={selectSx}
            inputProps={{ 'aria-label': 'Filter by type' }}
          >
            <MenuItem value="">Type</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </Select>
        </FormControl>

        {/* Category Filter */}
        {showCategoryFilter && (
        <FormControl size="small" sx={{ minWidth: '160px', height: '40px' }}>
          <Select
            value={filters.category}
            onChange={(e) => setFilters({ category: e.target.value })}
            displayEmpty
            IconComponent={KeyboardArrowDownIcon}
            sx={selectSx}
            MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
          >
            <MenuItem value="">Category</MenuItem>
            {/* Filter by id: that's what the API matches on. */}
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
            {/* Category id from the URL that isn't in the list - keep it selectable so it can be cleared. */}
            {filters.category && !categories.some((c) => c.id === filters.category) && (
              <MenuItem value={filters.category}>Unknown category</MenuItem>
            )}
          </Select>
        </FormControl>
        )}

        {/* Sort */}
        <FormControl size="small" sx={{ minWidth: '170px', height: '40px' }}>
          <Select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = (e.target.value as string).split('-') as [
                'date' | 'amount',
                'asc' | 'desc',
              ];
              setFilters({ sortBy, sortOrder });
            }}
            IconComponent={KeyboardArrowDownIcon}
            sx={selectSx}
          >
            <MenuItem value="date-desc">Newest first</MenuItem>
            <MenuItem value="date-asc">Oldest first</MenuItem>
            <MenuItem value="amount-desc">Amount: High to Low</MenuItem>
            <MenuItem value="amount-asc">Amount: Low to High</MenuItem>
          </Select>
        </FormControl>

        {/* Reset Filters, pinned to the right */}
        <Button
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          startIcon={<RestartAltIcon />}
          sx={{
            ml: 'auto',
            height: '40px',
            textTransform: 'none',
            fontSize: '0.9rem',
            color: hasActiveFilters ? 'primary.main' : '#aaa',
          }}
        >
          Reset Filters
        </Button>
      </Box>
    </Box>
  );
}
