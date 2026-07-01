export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const sanitized = String(url).trim();
  if (sanitized.toLowerCase().startsWith('javascript:')) {
    return '';
  }
  return escapeHtml(sanitized);
}
