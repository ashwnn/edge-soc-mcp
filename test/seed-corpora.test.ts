import { describe, expect, test } from "bun:test";
import { resolveSigmaZipUrl } from "../scripts/seed-corpora.js";

describe("resolveSigmaZipUrl", () => {
  test("accepts the current unsuffixed Sigma all-rules asset name", () => {
    expect(
      resolveSigmaZipUrl([
        {
          name: "sigma_all_rules.zip",
          browser_download_url:
            "https://github.com/SigmaHQ/sigma/releases/download/r2026-04-01/sigma_all_rules.zip",
        },
      ])
    ).toBe("https://github.com/SigmaHQ/sigma/releases/download/r2026-04-01/sigma_all_rules.zip");
  });

  test("accepts older suffixed Sigma all-rules asset names", () => {
    expect(
      resolveSigmaZipUrl([
        {
          name: "sigma_all_rules_20240101.zip",
          browser_download_url:
            "https://github.com/SigmaHQ/sigma/releases/download/r2024-01-01/sigma_all_rules_20240101.zip",
        },
      ])
    ).toBe(
      "https://github.com/SigmaHQ/sigma/releases/download/r2024-01-01/sigma_all_rules_20240101.zip"
    );
  });

  test("throws when no all-rules asset exists", () => {
    expect(() =>
      resolveSigmaZipUrl([
        {
          name: "sigma_core.zip",
          browser_download_url:
            "https://github.com/SigmaHQ/sigma/releases/download/r2026-04-01/sigma_core.zip",
        },
      ])
    ).toThrow("Could not find latest Sigma release asset");
  });
});
