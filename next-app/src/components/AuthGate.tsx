'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

const PASSKEY_KEY = 'hca:passkey_enrolled';

function getPasskeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Passkey';
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'Passkey';
}

async function hasPlatformBiometrics(): Promise<boolean> {
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

type AuthState =
  | 'pending'
  | 'form'
  | 'submitting'
  | 'passkey'
  | 'passkey-submitting'
  | 'enroll-prompt'
  | 'enrolling'
  | 'ok'
  | 'expired';

/**
 * AuthGate — wraps the app behind session authentication.
 *
 * Flow A — passkey enrolled:
 *   1. Check session → 401 → localStorage flag + WebAuthn support → show passkey screen
 *   2. Tap "Sign in with Face ID" → /api/auth/passkey/login-options
 *      → startAuthentication() → /api/auth/passkey/login-verify → ok
 *
 * Flow B — no passkey:
 *   1. Check session → 401 → show password form
 *   2. Submit → /api/auth/login → ok
 *   3. If WebAuthn available & not enrolled → show enrollment prompt
 *
 * Flow C — valid session:
 *   1. Check session → 200 → render app immediately (no flash)
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('pending');
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  // Lazy-init so it only runs in the browser (avoids SSR mismatch)
  const [passkeyLabel] = useState(() => getPasskeyLabel());

  useEffect(() => {
    fetch('/api/auth/check').then(async r => {
      if (r.ok) {
        setState('ok');
        return;
      }
      // Show passkey screen only if enrolled here AND this device has biometric auth.
      const enrolled = !!localStorage.getItem(PASSKEY_KEY);
      if (enrolled && browserSupportsWebAuthn() && await hasPlatformBiometrics()) {
        setState('passkey');
      } else {
        setState('form');
      }
    }).catch(() => setState('form'));
  }, []);

  // Listen for session-expired events while the app is running.
  useEffect(() => {
    if (state !== 'ok') return;
    async function handleExpired() {
      setSessionExpired(true);
      setError('');
      const enrolled = !!localStorage.getItem(PASSKEY_KEY);
      if (enrolled && browserSupportsWebAuthn() && await hasPlatformBiometrics()) {
        setState('passkey');
      } else {
        setState('form');
      }
    }
    window.addEventListener('hca:session-expired', handleExpired);
    return () => window.removeEventListener('hca:session-expired', handleExpired);
  }, [state]);

  useEffect(() => {
    if (state === 'form') usernameRef.current?.focus();
  }, [state]);

  // ---------------------------------------------------------------------------
  // Password form submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState('submitting');
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: fd.get('username') as string,
          password: fd.get('password') as string,
        }),
      });
      if (res.ok) {
        setSessionExpired(false);
        // Offer enrollment if this device has biometric auth and no passkey registered yet.
        const enrolled = !!localStorage.getItem(PASSKEY_KEY);
        if (!enrolled && browserSupportsWebAuthn() && await hasPlatformBiometrics()) {
          setState('enroll-prompt');
        } else {
          setState('ok');
        }
      } else {
        setError('Invalid username or password.');
        setState('form');
      }
    } catch {
      setError('Could not connect — please try again.');
      setState('form');
    }
  }

  // ---------------------------------------------------------------------------
  // Passkey sign-in
  // ---------------------------------------------------------------------------

  async function handlePasskeySignIn() {
    setState('passkey-submitting');
    setError('');
    try {
      const optRes = await fetch('/api/auth/passkey/login-options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Could not get options');
      const options = await optRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verRes = await fetch('/api/auth/passkey/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      if (verRes.ok) {
        setSessionExpired(false);
        setState('ok');
      } else {
        throw new Error('Verification failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
        setError(`${passkeyLabel} was cancelled. Try again or use your password.`);
      } else {
        setError('Sign-in failed. Please use your password instead.');
      }
      setState('passkey');
    }
  }

  // ---------------------------------------------------------------------------
  // Passkey enrollment
  // ---------------------------------------------------------------------------

  async function handleEnroll() {
    setState('enrolling');
    setError('');
    try {
      const optRes = await fetch('/api/auth/passkey/register-options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Could not get options');
      const options = await optRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const verRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (verRes.ok) {
        localStorage.setItem(PASSKEY_KEY, '1');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Face ID setup failed: ${msg}`);
      setState('enroll-prompt');
      return;
    }
    setState('ok');
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (state === 'ok') return <>{children}</>;
  if (state === 'pending') return (
    <div style={wrapStyle}>
      <div style={spinnerStyle} />
    </div>
  );

  const loginContent = (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <h1 style={titleStyle}>Home Control</h1>
      {sessionExpired && (
        <p style={{ ...subStyle, color: 'var(--color-red, #e53e3e)', marginBottom: 16 }}>
          Your session has expired. Please sign in again.
        </p>
      )}

        {/* ---- Passkey sign-in ---- */}
        {(state === 'passkey' || state === 'passkey-submitting') && (
          <>
            <p style={subStyle}>Sign in with biometrics</p>
            <button
              onClick={handlePasskeySignIn}
              disabled={state === 'passkey-submitting'}
              style={{ ...btnStyle, marginBottom: 12 }}
            >
              {state === 'passkey-submitting' ? 'Verifying…' : `🔒  Sign in with ${passkeyLabel}`}
            </button>
            {error && <p style={errStyle}>{error}</p>}
            <button
              onClick={() => { setError(''); setState('form'); }}
              style={linkStyle}
            >
              Use password instead
            </button>
          </>
        )}

        {/* ---- Password form ---- */}
        {(state === 'form' || state === 'submitting') && (
          <>
            <p style={subStyle}>Sign in with your WordPress account</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                ref={usernameRef}
                name="username"
                type="text"
                placeholder="Username"
                autoComplete="username"
                required
                disabled={state === 'submitting'}
                style={inputStyle}
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                required
                disabled={state === 'submitting'}
                style={inputStyle}
              />
              {error && <p style={errStyle}>{error}</p>}
              <button
                type="submit"
                disabled={state === 'submitting'}
                style={{ ...btnStyle, background: state === 'submitting' ? 'var(--text2)' : 'var(--accent)' }}
              >
                {state === 'submitting' ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </>
        )}

        {/* ---- Enrollment prompt ---- */}
        {(state === 'enroll-prompt' || state === 'enrolling') && (
          <>
            <p style={subStyle}>Enable {passkeyLabel} for quick sign-in next time.</p>
            {error && <p style={errStyle}>{error}</p>}
            <button
              onClick={handleEnroll}
              disabled={state === 'enrolling'}
              style={{ ...btnStyle, marginBottom: 12 }}
            >
              {state === 'enrolling' ? 'Setting up…' : `Enable ${passkeyLabel}`}
            </button>
            <button
              onClick={() => setState('ok')}
              disabled={state === 'enrolling'}
              style={linkStyle}
            >
              Not now
            </button>
          </>
        )}
    </div>
  );

  if (sessionExpired) {
    return (
      <>
        {children}
        <div style={expiredOverlayStyle}>
          {loginContent}
        </div>
      </>
    );
  }

  return <div style={wrapStyle}>{loginContent}</div>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapStyle: React.CSSProperties = {
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
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: 'var(--text)',
  margin: '0 0 8px',
  letterSpacing: '-0.3px',
};

const subStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text2)',
  margin: '0 0 28px',
};

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px 0',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius, 12px)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s',
  textAlign: 'center',
};

const linkStyle: React.CSSProperties = {
  display: 'block',
  background: 'none',
  border: 'none',
  color: 'var(--text2)',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
  width: '100%',
  padding: '8px 0',
};

const errStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--color-red, #e53e3e)',
  margin: '0',
};

const inputStyle: React.CSSProperties = {
  padding: '11px 14px',
  background: 'var(--card)',
  border: '1px solid var(--sep)',
  borderRadius: 'var(--radius, 12px)',
  fontSize: 15,
  color: 'var(--text)',
  fontFamily: 'var(--font, -apple-system, system-ui, sans-serif)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '2.5px solid var(--sep)',
  borderTopColor: 'var(--accent)',
  animation: 'spin 0.75s linear infinite',
};

const expiredOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  fontFamily: 'var(--font, -apple-system, system-ui, sans-serif)',
};
