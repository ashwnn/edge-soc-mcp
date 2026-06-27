import { describe, expect, test } from "bun:test";
import { slimAttack } from "../scripts/slim/attack.js";
import { slimGtfobins } from "../scripts/slim/gtfobins.js";
import { slimHijackLibs } from "../scripts/slim/hijacklibs.js";
import { slimLolbas } from "../scripts/slim/lolbas.js";

describe("slimLolbas", () => {
  test("keeps only the analyst-facing fields", () => {
    const result = slimLolbas([
      {
        Name: "rundll32.exe",
        Full_Path: ["C:\\Windows\\System32\\rundll32.exe"],
        Commands: [
          {
            Command: "rundll32.exe foo",
            Description: "Proxy execution",
            Category: "Execute",
            MitreID: "T1218.011",
          },
        ],
        Detection: ["Process monitoring"],
      },
    ]);

    expect(result).toEqual([
      {
        name: "rundll32.exe",
        paths: ["C:\\Windows\\System32\\rundll32.exe"],
        commands: [
          {
            command: "rundll32.exe foo",
            description: "Proxy execution",
            category: "Execute",
            mitreID: "T1218.011",
          },
        ],
        detections: ["Process monitoring"],
      },
    ]);
  });
});

describe("slimGtfobins", () => {
  test("maps functions to command-like entries", () => {
    const result = slimGtfobins(
      {
        bash: { functions: ["shell", "file-read"] },
      },
      { bash: ["T1059.004"] }
    );

    expect(result[0]?.commands?.[0]?.mitreID).toBe("T1059.004");
    expect(result[0]?.commands?.length).toBe(2);
  });
});

describe("slimHijackLibs", () => {
  test("normalizes hijack library entries", () => {
    const result = slimHijackLibs([
      {
        dll: "version.dll",
        expectedLocations: ["C:\\Windows\\System32"],
        vulnerableExecutables: ["app.exe"],
        type: "sideloading",
      },
    ]);

    expect(result[0]?.dll).toBe("version.dll");
    expect(result[0]?.vulnerableExecutables).toEqual(["app.exe"]);
  });
});

describe("slimAttack", () => {
  test("extracts ATT&CK ids and tactics from STIX attack-patterns", () => {
    const result = slimAttack({
      objects: [
        {
          type: "attack-pattern",
          name: "Rundll32",
          description: "Signed binary proxy execution.",
          external_references: [
            {
              source_name: "mitre-attack",
              external_id: "T1218.011",
              url: "https://attack.mitre.org/techniques/T1218/011/",
            },
          ],
          kill_chain_phases: [{ phase_name: "defense-evasion" }],
          x_mitre_platforms: ["Windows"],
          x_mitre_data_sources: ["Process monitoring"],
        },
      ],
    });

    expect(result).toEqual([
      {
        id: "T1218.011",
        name: "Rundll32",
        tactics: ["defense-evasion"],
        description: "Signed binary proxy execution.",
        data_sources: ["Process monitoring"],
        platforms: ["Windows"],
        is_subtechnique: false,
        url: "https://attack.mitre.org/techniques/T1218/011/",
      },
    ]);
  });
});
