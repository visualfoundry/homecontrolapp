'use client';

import React, { useEffect, useRef, useState } from 'react';

type AuthState = 'pending' | 'form' | 'submitting' | 'ok';

/**
 * AuthGate — shows a login form until a valid hca_session cookie exists.
 *
 * Flow:
 *   1. GET /api/auth/check
 *      → 200: session cookie live → render app immediately (return visits)
 *      → 401: no valid session → show login form
 *   2. On form submit → POST /api/auth/login { username, password }
 *      → 200: session cookie set → render app
 *      → 401: show error in form
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('pending');
  const [error, setError] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/check')
      .then((r) => setState(r.ok ? 'ok' : 'form'))
      .catch(() => setState('form'));
  }, []);

  // Auto-focus username input when form appears.
  useEffect(() => {
    if (state === 'form') usernameRef.current?.focus();
  }, [state]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username') as string;
    const password = fd.get('password') as string;

    setState('submitting');
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setState('ok');
      } else {
        setError('Invalid username or password.');
        setState('form');
      }
    } catch {
      setError('Could not connect — please try again.');
      setState('form');
    }
  }

  if (state === 'ok') return <>{children}</>;

  // Blank while checking session — no flash on return visits.
  if (state === 'pending') return null;

  const submitting = state === 'submitting';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: 'var(--bg)',
        padding: '2rem',
        boxSizing: 'border-box',
        fontFamily: 'var(--font, -apple-system, system-ui, sans-serif)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 320 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 8px',
            letterSpacing: '-0.3px',
          }}
        >
          Home Control
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            margin: '0 0 28px',
          }}
        >
          Sign in with your WordPress account
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={usernameRef}
            name="username"
            type="text"
            placeholder="Username"
            autoComplete="username"
            required
            disabled={submitting}
            style={inputStyle}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            disabled={submitting}
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: 13, color: 'var(--color-red, #e53e3e)', margin: '0' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 4,
              padding: '12px 0',
              background: submitting ? 'var(--text-secondary)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius, 12px)',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px',
  background: 'var(--card-bg)',
  border: '1px solid var(--separator)',
  borderRadius: 'var(--radius, 12px)',
  fontSize: 15,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font, -apple-system, system-ui, sans-serif)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
