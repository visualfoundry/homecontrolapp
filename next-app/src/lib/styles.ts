// Shared button / layout style constants used across multiple screens.
// All values taken directly from the design prototype (screens-main.jsx, etc.)

import type React from 'react';

export const iconBtn: React.CSSProperties = {
  background: 'var(--card)', border: 'none', cursor: 'pointer',
  width: 40, height: 40, borderRadius: 20, color: 'var(--text)',
  boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
};

export const pillBtn: React.CSSProperties = {
  background: 'var(--accent)', border: 'none', cursor: 'pointer',
  color: '#fff', fontSize: 14, fontWeight: 640, padding: '9px 16px',
  borderRadius: 20, WebkitTapHighlightColor: 'transparent',
};

export const stepBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 17, border: 'none', cursor: 'pointer',
  background: 'var(--icon-bg)', color: 'var(--text)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};

export const reorderBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 9, border: 'none',
  background: 'var(--icon-bg)', color: 'var(--text2)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};

export const poolStep: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer',
  background: 'var(--card)', color: 'var(--text)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  boxShadow: 'var(--shadow)', WebkitTapHighlightColor: 'transparent',
};
