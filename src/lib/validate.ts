/**
 * Observable type detection and validation guards.
 *
 * Regexes are conservative: prefer false negatives over false positives.
 * Each guard returns a specific type or null/false so callers can
 * branch on the result without a second call.
 */

import type { ObservableType } from "../types.js";

// ---------------------------------------------------------------------------
// Individual guards
// ---------------------------------------------------------------------------

/**
 * Returns true if `value` looks like an IPv4 or IPv6 address.
 * Accepts standard dotted-decimal IPv4 and compressed IPv6.
 */
export function isIp(value: string): boolean {
  // IPv4: four octets 0-255
  const ipv4 =
    /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  // IPv6: at least one colon, hex segments (simplified - rejects garbage)
  const ipv6 = /^[0-9a-fA-F:]{2,39}$/;
  return ipv4.test(value) || (value.includes(":") && ipv6.test(value));
}

/**
 * Returns true if `value` looks like a domain name (no path, no scheme).
 * Accepts internationalized domain names (IDN) with punycode (xn--) but
 * not raw Unicode; that keeps the regex simple.
 */
export function isDomain(value: string): boolean {
  // Must have at least one dot, no spaces, no slashes, no @
  const domain =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domain.test(value);
}

/**
 * Returns true if `value` looks like an HTTP(S) URL.
 */
export function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type HashType = "md5" | "sha1" | "sha256" | null;

/**
 * Returns the hash algorithm name if `value` looks like a known hash,
 * or null otherwise.
 *
 * - MD5:    32 hex chars
 * - SHA-1:  40 hex chars
 * - SHA-256: 64 hex chars
 */
export function isHash(value: string): HashType {
  const hex = /^[0-9a-fA-F]+$/;
  if (!hex.test(value)) return null;
  if (value.length === 32) return "md5";
  if (value.length === 40) return "sha1";
  if (value.length === 64) return "sha256";
  return null;
}

/**
 * Returns true if `value` looks like a CVE identifier.
 * Format: CVE-YYYY-NNNNN (4-digit year, 4+ digit number).
 */
export function isCve(value: string): boolean {
  return /^CVE-\d{4}-\d{4,}$/i.test(value);
}

/**
 * Returns true if `value` looks like an email address.
 * Conservative regex: local@domain.tld (no unusual characters).
 */
export function isEmail(value: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(value);
}

// ---------------------------------------------------------------------------
// Unified detector
// ---------------------------------------------------------------------------

/**
 * Detect the observable type of an arbitrary string value.
 * Returns null if no type can be determined.
 *
 * Priority order: ip > url > email > hash > cve > domain
 * (URL before domain so "https://example.com" isn't misclassified as a domain)
 */
export function detectObservable(value: string): ObservableType | null {
  const v = value.trim();
  if (!v) return null;

  if (isIp(v)) return "ip";
  if (isUrl(v)) return "url";
  if (isEmail(v)) return "email";
  const hashType = isHash(v);
  if (hashType !== null) return "hash";
  if (isCve(v)) return "cve";
  if (isDomain(v)) return "domain";

  return null;
}
