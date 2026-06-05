import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { resolveSkillArtifactWithCli } from "../src/resolver.js";

describe("resolveSkillArtifactWithCli", () => {
  it("uses an Ephemeral Resolution Workspace and returns the resolved Skill Folder", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "xcode-skills-test-"));
    const createdWorkspaces: string[] = [];
    const removedWorkspaces: string[] = [];

    const result = await resolveSkillArtifactWithCli("diagnose", {
      tempRoot,
      skillsCliPath: "/fake/skills/bin/cli.mjs",
      removeWorkspace: async (path) => {
        removedWorkspaces.push(path);
        await rm(path, { recursive: true, force: true });
      },
      runCommand: async (command) => {
        createdWorkspaces.push(command.cwd);
        expect(command.executable).toBe(process.execPath);
        expect(command.args).toEqual([
          "/fake/skills/bin/cli.mjs",
          "add",
          "diagnose",
          "--copy",
          "--yes",
        ]);

        const skillPath = join(command.cwd, ".agents", "skills", "diagnose");
        await mkdir(skillPath, { recursive: true });
        await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");
        await writeFile(command.cwd + "/skills-lock.json", '{"version":1}\n');

        return { exitCode: 0, stdout: "ok", stderr: "" };
      },
    });

    expect(result.skillIdentity).toBe("diagnose");
    expect(createdWorkspaces).toHaveLength(1);
    expect(removedWorkspaces).toEqual([]);
    await expect(readFile(join(result.artifactPath, "skills-lock.json"), "utf8"))
      .resolves.toBe('{"version":1}\n');
    expect(result.cleanup).toBeDefined();
    await result.cleanup!();
    expect(removedWorkspaces).toEqual([createdWorkspaces[0]]);
    await expect(stat(createdWorkspaces[0]!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("invokes the local skills CLI with pasted npx skills add arguments", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "xcode-skills-test-"));
    const skillUrl = "https://github.com/acme/skills.git";

    await resolveSkillArtifactWithCli(`npx skills add ${skillUrl} --skill diagnose`, {
      tempRoot,
      skillsCliPath: "/fake/skills/bin/cli.mjs",
      runCommand: async (command) => {
        expect(command.executable).toBe(process.execPath);
        expect(command.args).toEqual([
          "/fake/skills/bin/cli.mjs",
          "add",
          skillUrl,
          "--skill",
          "diagnose",
          "--copy",
          "--yes",
        ]);

        const skillPath = join(command.cwd, ".agents", "skills", "diagnose");
        await mkdir(skillPath, { recursive: true });
        await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");

        return { exitCode: 0, stdout: "ok", stderr: "" };
      },
    });
  });

  it("cleans up the Ephemeral Resolution Workspace when the resolver command fails", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "xcode-skills-test-"));
    const removedWorkspaces: string[] = [];

    await expect(
      resolveSkillArtifactWithCli("diagnose", {
        tempRoot,
        skillsCliPath: "/fake/skills/bin/cli.mjs",
        removeWorkspace: async (path) => {
          removedWorkspaces.push(path);
          await rm(path, { recursive: true, force: true });
        },
        runCommand: async () => ({ exitCode: 1, stdout: "", stderr: "failed" }),
      }),
    ).rejects.toThrow(/failed/);

    expect(removedWorkspaces).toHaveLength(1);
    await expect(stat(removedWorkspaces[0]!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports verbose resolver diagnostics", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "xcode-skills-test-"));
    const diagnostics: string[] = [];

    await expect(
      resolveSkillArtifactWithCli("diagnose", {
        tempRoot,
        skillsCliPath: "/fake/skills/bin/cli.mjs",
        onVerbose: (line) => diagnostics.push(line),
        runCommand: async (command) => {
          const skillPath = join(command.cwd, ".agents", "skills", "diagnose");
          await mkdir(skillPath, { recursive: true });
          await writeFile(join(skillPath, "SKILL.md"), "# Diagnose\n");
          return { exitCode: 0, stdout: "resolver out", stderr: "resolver err" };
        },
      }),
    ).resolves.toMatchObject({ skillIdentity: "diagnose" });

    expect(diagnostics.join("\n")).toContain("/fake/skills/bin/cli.mjs add diagnose --copy --yes");
    expect(diagnostics.join("\n")).toContain("workspace:");
    expect(diagnostics.join("\n")).toContain("stdout: resolver out");
    expect(diagnostics.join("\n")).toContain("stderr: resolver err");
  });
});
