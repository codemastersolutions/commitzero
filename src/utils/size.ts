export function parseSizeToBytes(
  size: string | number,
  defaultBytes: number = 2 * 1024 * 1024
): number {
  if (typeof size === "number") {
    return size;
  }
  if (!size) {
    return defaultBytes;
  }

  const s = size.trim().toUpperCase();
  const match = s.match(/^([\d.]+)([A-Z]*)$/);

  if (!match) {
    // If it doesn't match expected pattern, try parsing as float, assuming bytes
    const val = parseFloat(s);
    return isNaN(val) ? defaultBytes : val;
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (isNaN(value)) {
    return defaultBytes;
  }

  switch (unit) {
    case "KB":
    case "K":
      return value * 1024;
    case "MB":
    case "M":
      return value * 1024 * 1024;
    case "GB":
    case "G":
      return value * 1024 * 1024 * 1024;
    case "B":
    case "":
      return value;
    default:
      // Unknown unit, fallback to bytes if it's just a number, or default
      return value;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}
