// Shown by Next.js App Router while page.tsx is streaming / suspending.
// Uses raw token values (no CSS vars) since this renders before globals.css hydrates.
export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      background: 'var(--bg, #EEEDEA)',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '2.5px solid rgba(60,58,54,0.12)',
        borderTopColor: '#E0483D',
        animation: 'spin 0.75s linear infinite',
      }} />
    </div>
  );
}
