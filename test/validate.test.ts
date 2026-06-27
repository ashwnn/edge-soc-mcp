/**
 * Unit tests for src/lib/validate.ts
 * Run with: bun test
 */

import { describe, expect, test } from "bun:test";
import {
  detectObservable,
  isIp,
  isDomain,
  isUrl,
  isHash,
  isCve,
  isEmail,
} from "../src/lib/validate.js";

// ---------------------------------------------------------------------------
// isIp
// ---------------------------------------------------------------------------
describe("isIp", () => {
  test("accepts valid IPv4", () => {
    expect(isIp("1.2.3.4")).toBe(true);
    expect(isIp("192.168.0.1")).toBe(true);
    expect(isIp("255.255.255.255")).toBe(true);
    expect(isIp("0.0.0.0")).toBe(true);
  });

  test("accepts valid IPv6", () => {
    expect(isIp("2001:db8::1")).toBe(true);
    expect(isIp("::1")).toBe(true);
  });

  test("rejects non-IPs", () => {
    expect(isIp("example.com")).toBe(false);
    expect(isIp("256.0.0.1")).toBe(false);
    expect(isIp("not-an-ip")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDomain
// ---------------------------------------------------------------------------
describe("isDomain", () => {
  test("accepts valid domains", () => {
    expect(isDomain("example.com")).toBe(true);
    expect(isDomain("sub.example.co.uk")).toBe(true);
    expect(isDomain("xn--nxasmq6b.com")).toBe(true);
  });

  test("rejects non-domains", () => {
    expect(isDomain("https://example.com")).toBe(false);
    expect(isDomain("localhost")).toBe(false);
    expect(isDomain("192.168.1.1")).toBe(false);
    expect(isDomain("user@example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isUrl
// ---------------------------------------------------------------------------
describe("isUrl", () => {
  test("accepts http/https URLs", () => {
    expect(isUrl("https://example.com/path?q=1")).toBe(true);
    expect(isUrl("http://malware.example/payload")).toBe(true);
  });

  test("rejects non-HTTP URLs", () => {
    expect(isUrl("ftp://example.com")).toBe(false);
    expect(isUrl("example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isHash
// ---------------------------------------------------------------------------
describe("isHash", () => {
  test("identifies MD5 (32 hex chars)", () => {
    expect(isHash("d41d8cd98f00b204e9800998ecf8427e")).toBe("md5");
  });

  test("identifies SHA-1 (40 hex chars)", () => {
    expect(isHash("da39a3ee5e6b4b0d3255bfef95601890afd80709")).toBe("sha1");
  });

  test("identifies SHA-256 (64 hex chars)", () => {
    expect(
      isHash(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      )
    ).toBe("sha256");
  });

  test("returns null for non-hashes", () => {
    expect(isHash("not-a-hash")).toBe(null);
    expect(isHash("abcdef")).toBe(null); // 6 chars
  });
});

// ---------------------------------------------------------------------------
// isCve
// ---------------------------------------------------------------------------
describe("isCve", () => {
  test("accepts valid CVE IDs", () => {
    expect(isCve("CVE-2024-12345")).toBe(true);
    expect(isCve("cve-2023-1234")).toBe(true); // case-insensitive
  });

  test("rejects invalid CVE IDs", () => {
    expect(isCve("CVE-24-1234")).toBe(false); // short year
    expect(isCve("CVE-2024-123")).toBe(false); // only 3 digits
    expect(isCve("CWE-123")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isEmail
// ---------------------------------------------------------------------------
describe("isEmail", () => {
  test("accepts valid emails", () => {
    expect(isEmail("user@example.com")).toBe(true);
    expect(isEmail("user+tag@sub.domain.org")).toBe(true);
  });

  test("rejects non-emails", () => {
    expect(isEmail("@example.com")).toBe(false);
    expect(isEmail("user@")).toBe(false);
    expect(isEmail("notanemail")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectObservable — integration
// ---------------------------------------------------------------------------
describe("detectObservable", () => {
  test("IP", () => expect(detectObservable("8.8.8.8")).toBe("ip"));
  test("URL before domain", () =>
    expect(detectObservable("https://example.com/path")).toBe("url"));
  test("email", () =>
    expect(detectObservable("evil@phish.example")).toBe("email"));
  test("MD5 hash", () =>
    expect(detectObservable("d41d8cd98f00b204e9800998ecf8427e")).toBe("hash"));
  test("CVE", () => expect(detectObservable("CVE-2024-99999")).toBe("cve"));
  test("domain", () => expect(detectObservable("evil.example.com")).toBe("domain"));
  test("unknown returns null", () =>
    expect(detectObservable("just some text")).toBe(null));
  test("empty string returns null", () =>
    expect(detectObservable("")).toBe(null));
});
