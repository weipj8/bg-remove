const MIB = 1024 * 1024;

export function formatMib(bytes: number): string {
  return `${(bytes / MIB).toFixed(1)} MB`;
}

export function formatRate(bytesPerSecond: number): string {
  const kb = bytesPerSecond / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${Math.round(kb)} KB/s`;
}

/** Spoken the way a person reads a download estimate, not as a decimal. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}
