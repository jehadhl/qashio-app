// app/global-error.tsx - last resort for errors in the root layout itself. It
// replaces the whole document, so it can't rely on the MUI theme/providers.
'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '80px 16px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>The app failed to load. Please try again.</p>
        <button
          onClick={reset}
          style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: '#a78f65', color: '#fff', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
