// Diagnostic helper — adds a data-control attribute to device control elements.
// Format: "Post Title | WP ID | EISY state ID"
// The EISY state ID is omitted when the device has no controlStateIds entry (e.g. scenes).
export function deviceTag(
  name: string,
  id: string,
  controlStateIds: Record<string, string> = {},
): string {
  const stateId = controlStateIds[id];
  return stateId ? `${name} | ${id} | ${stateId}` : `${name} | ${id}`;
}
