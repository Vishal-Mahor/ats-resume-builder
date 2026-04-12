'use client';
// app/providers.tsx
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#121213',
            color: '#f4f4f5',
            boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#121213' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#121213' } },
        }}
      />
    </>
  );
}
