// localStorage helpers for per-person avatar photos (user preferences plane).
// Photos are stored as base64 data URLs keyed by person id.

const key = (id: string) => `hca-avatar-${id}`;

export function getAvatarPhoto(id: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key(id));
}

export function setAvatarPhoto(id: string, dataUrl: string): void {
  localStorage.setItem(key(id), dataUrl);
}

export function clearAvatarPhoto(id: string): void {
  localStorage.removeItem(key(id));
}
