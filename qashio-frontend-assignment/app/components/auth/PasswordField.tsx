// components/auth/PasswordField.tsx
'use client';

import { useState } from 'react';
import { IconButton, InputAdornment, TextField, TextFieldProps } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// TextField with a show/hide toggle; accepts every normal TextField prop.
export default function PasswordField(props: TextFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        ...props.slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                size="small"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((v) => !v)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
