/**
 * Cryptographic hashing utilities using WebCrypto (available in Workers).
 * Both functions are async because crypto.subtle.digest is async.
 */

async function digest(algorithm: string, input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest(algorithm, encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hex digest of a string. */
export async function sha256hex(s: string): Promise<string> {
  return digest("SHA-256", s);
}

/** SHA-1 hex digest of a string. */
export async function sha1hex(s: string): Promise<string> {
  return digest("SHA-1", s);
}
