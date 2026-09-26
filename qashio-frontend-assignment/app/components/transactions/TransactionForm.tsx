// components/transactions/TransactionForm.tsx
'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  createFilterOptions,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { createTransactionSchema } from '@/lib/validators/transaction';
import { Transaction, TransactionFormData } from '@/app/types';
import {
  TransactionApiError,
  useCreateTransaction,
  useUpdateTransaction,
} from '@/app/services/transactionService';
import { useCategories } from '@/app/services/categoryService';
import CreateCategoryDialog from '@/app/components/categories/CreateCategoryDialog';

// Sentinel option rendered as "+ Add new category" at the bottom of the dropdown.
const ADD_CATEGORY_OPTION = '__add_category__';
const filterCategories = createFilterOptions<string>();

const NARRATION_MAX = 500;

type Status = Transaction['status'];
type TxType = Transaction['type'];
type FieldName = keyof TransactionFormData;
type FieldErrors = Partial<Record<FieldName, string>>;

// Raw input state: amount stays a string and date a Date so the inputs can be
// edited freely; both are converted to the API shape right before validation.
interface FormValues {
  date: Date | null;
  reference: string;
  counterparty: string;
  amount: string;
  status: Status;
  type: TxType;
  category: string;
  narration: string;
}

const INITIAL_VALUES: FormValues = {
  date: new Date(),
  reference: '',
  counterparty: '',
  amount: '',
  status: 'Completed',
  type: 'expense',
  category: '',
  narration: '',
};

const toFormValues = (transaction?: Transaction): FormValues =>
  transaction
    ? {
        date: new Date(transaction.date),
        reference: transaction.reference,
        counterparty: transaction.counterparty,
        amount: String(transaction.amount),
        status: transaction.status,
        type: transaction.type,
        category: transaction.category,
        narration: transaction.narration ?? '',
      }
    : { ...INITIAL_VALUES, date: new Date() };

const STATUS_OPTIONS: { value: Status; icon: React.ReactNode; color: string }[] = [
  { value: 'Completed', icon: <CheckCircleOutlineIcon fontSize="small" />, color: '#2e7d32' },
  { value: 'Pending', icon: <ScheduleIcon fontSize="small" />, color: '#f57f17' },
  { value: 'Failed', icon: <ErrorOutlineIcon fontSize="small" />, color: '#c62828' },
];

const TYPE_OPTIONS: { value: TxType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'expense', label: 'Expense', icon: <ArrowUpwardIcon fontSize="small" />, color: '#c62828' },
  { value: 'income', label: 'Income', icon: <ArrowDownwardIcon fontSize="small" />, color: '#2e7d32' },
];

// Trimming, required checks and messages all live in the zod schema; this only
// converts the raw inputs into the types the schema expects.
const toPayload = (values: FormValues) => ({
  ...values,
  date: values.date && !isNaN(values.date.getTime()) ? values.date.toISOString() : undefined,
  amount: values.amount === '' ? undefined : Number(values.amount),
});

const validate = (values: FormValues): { data: TransactionFormData | null; errors: FieldErrors } => {
  const result = createTransactionSchema.safeParse(toPayload(values));
  if (result.success) return { data: result.data as TransactionFormData, errors: {} };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as FieldName;
    if (!errors[field]) errors[field] = issue.message;
  }
  return { data: null, errors };
};

interface TransactionFormProps {
  // When given, the form edits this transaction instead of creating a new one.
  transaction?: Transaction;
  onSuccess: (transaction: Transaction) => void;
  onCancel: () => void;
}

export default function TransactionForm({ transaction, onSuccess, onCancel }: TransactionFormProps) {
  const isEdit = !!transaction;
  const [values, setValues] = useState<FormValues>(() => toFormValues(transaction));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [categoryInput, setCategoryInput] = useState('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError } =
    useCategories();

  // Keep the current value selectable even if it is not (yet) in the fetched list.
  const categoryOptions = useMemo(() => {
    const names = categories.map((c) => c.name);
    if (values.category && !names.includes(values.category)) names.unshift(values.category);
    return names;
  }, [categories, values.category]);

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const {
    isPending,
    error: mutationError,
    reset: resetMutation,
  } = isEdit ? updateMutation : createMutation;

  const { errors: clientErrors } = validate(values);

  // Show a field's error once the user has left it (or tried to submit),
  // so they are not yelled at while still typing for the first time.
  const errorFor = (field: FieldName) =>
    (touched[field] || submitAttempted ? clientErrors[field] : undefined) ?? serverErrors[field];

  const setField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const markTouched = (field: FieldName) => () =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    resetMutation();

    const { data } = validate(values);
    if (!data) return;

    const callbacks = {
      onSuccess,
      onError: (err: Error) => {
        if (err instanceof TransactionApiError && err.details.length) {
          setServerErrors(
            Object.fromEntries(err.details.map((d) => [d.field, d.message])) as FieldErrors
          );
        }
      },
    };

    if (transaction) {
      updateMutation.mutate({ id: transaction.id, data }, callbacks);
    } else {
      createMutation.mutate(data, callbacks);
    }
  };

  const generalError =
    mutationError &&
    !(mutationError instanceof TransactionApiError && mutationError.details.length)
      ? mutationError.message
      : null;

  return (
    <Paper
      component="form"
      noValidate
      onSubmit={handleSubmit}
      elevation={0}
      sx={{ p: { xs: 2.5, sm: 4 }, border: '1px solid #e5e7eb', borderRadius: 2 }}
    >
      {generalError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={resetMutation}>
          {generalError}
        </Alert>
      )}

      {/* Type: money out or in */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Type
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={values.type}
        onChange={(_, next: TxType | null) => next && setField('type', next)}
        sx={{ mb: 3 }}
      >
        {TYPE_OPTIONS.map(({ value, label, icon, color }) => (
          <ToggleButton
            key={value}
            value={value}
            sx={{
              gap: 1,
              textTransform: 'none',
              fontWeight: 600,
              '&.Mui-selected, &.Mui-selected:hover': {
                color,
                bgcolor: `${color}14`,
                borderColor: `${color}80`,
              },
            }}
          >
            {icon}
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Status */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Status
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={values.status}
        onChange={(_, next: Status | null) => next && setField('status', next)}
        sx={{ mb: 3 }}
      >
        {STATUS_OPTIONS.map(({ value, icon, color }) => (
          <ToggleButton
            key={value}
            value={value}
            sx={{
              gap: 1,
              textTransform: 'none',
              fontWeight: 600,
              '&.Mui-selected, &.Mui-selected:hover': {
                color,
                bgcolor: `${color}14`,
                borderColor: `${color}80`,
              },
            }}
          >
            {icon}
            {value}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        <TextField
          label="Amount"
          required
          type="number"
          value={values.amount}
          onChange={(e) => setField('amount', e.target.value)}
          onBlur={markTouched('amount')}
          error={!!errorFor('amount')}
          helperText={errorFor('amount')}
          slotProps={{
            input: { endAdornment: <InputAdornment position="end">AED</InputAdornment> },
            htmlInput: { min: 0, step: '0.01', inputMode: 'decimal' },
          }}
        />

        <DateTimePicker
          label="Date"
          value={values.date}
          onChange={(date) => setField('date', date)}
          onClose={markTouched('date')}
          disableFuture
          slotProps={{
            textField: {
              required: true,
              onBlur: markTouched('date'),
              error: !!errorFor('date'),
              helperText: errorFor('date'),
            },
          }}
        />

        <TextField
          label="Reference"
          required
          placeholder="e.g. INV-1024"
          value={values.reference}
          onChange={(e) => setField('reference', e.target.value)}
          onBlur={markTouched('reference')}
          error={!!errorFor('reference')}
          helperText={errorFor('reference')}
          slotProps={{ htmlInput: { maxLength: 50 } }}
        />

        <TextField
          label="Counterparty"
          required
          placeholder="e.g. Acme Corp"
          value={values.counterparty}
          onChange={(e) => setField('counterparty', e.target.value)}
          onBlur={markTouched('counterparty')}
          error={!!errorFor('counterparty')}
          helperText={errorFor('counterparty')}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />

        {/* Pick an existing category, or create one via the dialog */}
        <Autocomplete
          options={categoryOptions}
          value={values.category || null}
          onChange={(_, value) => {
            if (value === ADD_CATEGORY_OPTION) {
              setCategoryDialogOpen(true);
              return;
            }
            setField('category', value ?? '');
          }}
          inputValue={categoryInput}
          onInputChange={(_, value) => setCategoryInput(value)}
          filterOptions={(options, state) => [
            ...filterCategories(options, state),
            ADD_CATEGORY_OPTION,
          ]}
          getOptionLabel={(option) => (option === ADD_CATEGORY_OPTION ? '' : option)}
          renderOption={({ key, ...props }, option) =>
            option === ADD_CATEGORY_OPTION ? (
              <Box
                component="li"
                key={key}
                {...props}
                sx={{ gap: 1, color: 'primary.main', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}
              >
                <AddIcon fontSize="small" />
                {categoryInput.trim() && !categoryOptions.includes(categoryInput.trim())
                  ? `Add "${categoryInput.trim()}"`
                  : 'Add new category'}
              </Box>
            ) : (
              <li key={key} {...props}>
                {option}
              </li>
            )
          }
          loading={categoriesLoading}
          sx={{ gridColumn: { sm: '1 / -1' } }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Category"
              required
              placeholder={categoryOptions.length ? 'Select a category' : 'Create your first category'}
              onBlur={markTouched('category')}
              error={!!errorFor('category') || categoriesError}
              helperText={
                errorFor('category') ?? (categoriesError ? 'Could not load categories' : undefined)
              }
            />
          )}
        />

        <TextField
          label="Narration"
          required
          multiline
          minRows={3}
          placeholder="What was this transaction for?"
          value={values.narration}
          onChange={(e) => setField('narration', e.target.value)}
          onBlur={markTouched('narration')}
          error={!!errorFor('narration')}
          helperText={errorFor('narration') ?? `${values.narration.length}/${NARRATION_MAX}`}
          sx={{ gridColumn: { sm: '1 / -1' } }}
          slotProps={{
            htmlInput: { maxLength: NARRATION_MAX },
            formHelperText: { sx: { textAlign: errorFor('narration') ? 'left' : 'right' } },
          }}
        />
      </Box>

      <CreateCategoryDialog
        open={categoryDialogOpen}
        initialName={categoryOptions.includes(categoryInput.trim()) ? '' : categoryInput.trim()}
        onClose={() => setCategoryDialogOpen(false)}
        onCreated={(category) => {
          setField('category', category.name);
          setTouched((prev) => ({ ...prev, category: true }));
          setCategoryDialogOpen(false);
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 4 }}>
        <Button onClick={onCancel} disabled={isPending} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disableElevation
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ textTransform: 'none', px: 3 }}
        >
          {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Transaction'}
        </Button>
      </Box>
    </Paper>
  );
}
