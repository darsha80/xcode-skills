# xcode-skills v1 PRD

Status: ready-for-agent

## Problem Statement

Xcode's Coding Assistant integrates with Codex and Claude through fixed Xcode-managed locations. Agent Skills installed for other tools, global agent environments, or project-local contexts are not automatically available to Xcode. Users need a focused way to install, inspect, enable, disable, and uninstall existing Agent Skills for Xcode without disturbing unrelated Xcode files, global skill state, or the directory where the command was run.

## Solution

Build `xcode-skills`, an npm-published TypeScript CLI for managing Agent Skills inside Xcode's Codex and Claude Agent Integrations. The tool will use the `skills` package as the Skill Source Resolver, install resolved Skill Folders into activated Xcode integration roots, infer state from the filesystem, and provide safe lifecycle commands plus a later TUI for day-to-day enable/disable management.

## User Stories

1. As an Xcode user, I want to install an existing Agent Skill for Codex, so that Xcode's Codex Agent Integration can use it.
2. As an Xcode user, I want to install an existing Agent Skill for Claude, so that Xcode's Claude Agent Integration can use it.
3. As an Xcode user, I want to install one Agent Skill for both Codex and Claude, so that both integrations receive the same resolved version.
4. As an Xcode user, I want to choose Codex, Claude, or both interactively when I omit a target, so that write commands are explicit without requiring flag memorization.
5. As a script author, I want `--target codex`, `--target claude`, and `--target both`, so that automation can run without prompts.
6. As an Xcode user, I want missing single-target integrations to fail clearly, so that I know Xcode must activate that Agent Integration first.
7. As an Xcode user, I want `both` to allow partial success with warnings when one integration is missing, so that available integrations can still be updated.
8. As an Xcode user, I want `xcode-skills` to avoid creating missing integration roots, so that Xcode remains the authority for activating Agent Integrations.
9. As an Xcode user, I want `xcode-skills` to create `skills/` inside activated roots when needed, so that an activated integration can receive its first skill.
10. As an Xcode user, I want Skill Specs to be accepted in the same form supported by the resolver, so that I do not learn a second skill reference syntax.
11. As an Xcode user, I want installs to use copied artifacts rather than symlinks, so that temporary resolution workspaces can be deleted safely.
12. As an Xcode user, I want the current directory unchanged after install, so that running the command from any folder leaves no trace there.
13. As an Xcode user, I want the Ephemeral Resolution Workspace cleaned up even after failures, so that failed installs do not leave temporary files behind.
14. As an Xcode user, I want installing an already installed Skill Identity to update that Skill Folder only, so that unrelated Skill Folders are preserved.
15. As an Xcode user, I want the Skill Lock File copied with the specific Skill Folder, so that resolved metadata travels with that Agent Skill.
16. As an Xcode user, I want no-lock Skill Folders to be visible but marked unknown, so that manually placed skills are not hidden.
17. As an Xcode user, I want overwriting a no-lock folder to require confirmation, so that manual work is not destroyed silently.
18. As an Xcode user, I want `--yes` to bypass confirmations, so that trusted automation can proceed non-interactively.
19. As an Xcode user, I want `--dry-run` for write commands, so that I can see intended changes before Xcode-managed locations are modified.
20. As an Xcode user, I want `install --dry-run` to resolve the skill but not copy into Xcode, so that planned changes include the real Skill Identity.
21. As an Xcode user, I want disabled skills to be unavailable to Xcode, so that disabling means the integration cannot use that skill.
22. As an Xcode user, I want disablement to be reversible offline, so that I can re-enable a skill without downloading it again.
23. As an Xcode user, I want disabled skills stored beside active skills in `.xcode-skills/disabled/`, so that each Agent Integration keeps independent enabled and disabled state.
24. As an Xcode user, I want enabling a disabled skill to move it back into active skills, so that there is one clear enabled copy.
25. As an Xcode user, I want disabling an enabled skill to move it out of active discovery, so that Xcode no longer sees it.
26. As an Xcode user, I want conflicts reported when enabled and disabled copies both exist, so that ambiguous filesystem state is visible.
27. As an Xcode user, I want conflict states to avoid silent repair in v1, so that the tool does not delete or overwrite without defined semantics.
28. As an Xcode user, I want suspicious folders without `SKILL.md` to be shown, so that unexpected filesystem state is inspectable.
29. As an Xcode user, I want suspicious folders excluded from normal enable/disable, so that arbitrary folders are not treated as valid Agent Skills.
30. As an Xcode user, I want uninstall to remove both enabled and disabled copies, so that an Agent Skill is no longer managed or restorable for that integration.
31. As an Xcode user, I want uninstall to confirm before deleting no-lock or suspicious folders, so that destructive operations are deliberate.
32. As an Xcode user, I want uninstall to show exact paths before destructive deletion, so that I can verify what will be removed.
33. As an Xcode user, I want uninstall of an absent skill to be idempotent, so that cleanup scripts can run safely.
34. As an Xcode user, I want enable and disable to be idempotent for already enabled or disabled skills, so that repeated commands are safe.
35. As an Xcode user, I want `list` to show all activated integrations by default without prompting, so that read-only inspection is quick.
36. As an Xcode user, I want `list --target` filtering, so that I can inspect only Codex, only Claude, or both.
37. As a script author, I want `list --json`, so that automation can consume Filesystem State.
38. As an Xcode user, I want `list` to show enabled, disabled, conflict, suspicious, and unknown-provenance states, so that the filesystem model is transparent.
39. As an Xcode user, I want concise install output showing enabled targets and warnings, so that I understand partial success.
40. As an Xcode user, I want `--verbose` to show resolver commands and logs, so that resolver failures can be diagnosed.
41. As an Xcode user, I want `manage` to show Codex and Claude tabs, so that each Agent Integration can be managed independently.
42. As an Xcode user, I want inactive integration tabs to say not activated in Xcode, so that I understand why they cannot be managed.
43. As an Xcode user, I want `manage` to toggle enable/disable immediately, so that the TUI reflects real filesystem state.
44. As an Xcode user, I want `manage` to avoid install and uninstall in v1, so that destructive and resolver-backed operations stay in explicit commands.
45. As a maintainer, I want production Xcode paths hardcoded behind a path resolver, so that the product remains Xcode-specific while tests use fake roots.
46. As a maintainer, I want core lifecycle behavior separated from CLI parsing and TUI rendering, so that state transitions can be tested directly.
47. As a maintainer, I want the resolver boundary faked in tests, so that tests do not depend on network access or upstream resolver internals.
48. As a maintainer, I want the `skills` package invoked through its packaged CLI, so that xcode-skills does not depend on undocumented internal modules.
49. As a maintainer, I want xcode-skills to preserve unrelated files in integration roots, so that Xcode-owned and user-owned state is left alone.
50. As a maintainer, I want resolved artifacts with symlinks rejected, so that installs do not copy unexpected external content into Xcode-managed locations.

## Implementation Decisions

- Build xcode-skills as a TypeScript/Node npm CLI package with a `bin` entry named `xcode-skills`.
- Depend on the `skills` npm package and invoke its packaged CLI as the Skill Source Resolver instead of importing undocumented internals.
- Use hardcoded production integration roots for the Codex Agent Integration and Claude Agent Integration, while keeping the path resolver injectable for tests.
- Treat an Agent Integration as activated when its Xcode-managed root exists. xcode-skills must not create missing integration roots.
- Store enabled Skill Installations under the active `skills/` directory inside each activated root.
- Store Disabled Skill Installations under `.xcode-skills/disabled/` beside the active skill collection.
- Treat Filesystem State as the source of truth. Do not keep a separate manifest, install registry, or database.
- Use the resolver-assigned Skill Identity rather than parsing identity from the Skill Spec.
- Resolve an install once per command in an Ephemeral Resolution Workspace, then copy the same Resolved Skill Artifact to each selected Agent Integration.
- Always clean up the Ephemeral Resolution Workspace, including failure and dry-run cases.
- Perform minimal artifact guardrails after resolution: real directory, root `SKILL.md`, and no symlinks.
- Preserve file permissions when copying Skill Folders.
- Restrict writes to the selected Skill Identity under active and disabled skill paths. Preserve unrelated Skill Folders, Xcode files, and user files.
- Implement write-command Target Agent Integration behavior consistently: omitted `--target` triggers Interactive Target Selection; explicit `--target` is non-interactive.
- Allow partial success for `both` when one integration is missing. Fail when a single explicit target is missing.
- Make install create or update an Enabled Skill Installation. If a disabled copy exists for the same Skill Identity, remove or supersede it.
- Require confirmation or `--yes` before overwriting enabled no-lock/manual Skill Folders.
- Make uninstall remove both enabled and disabled copies for the selected Skill Identity and target integrations.
- Require confirmation or `--yes` before uninstall deletes no-lock or suspicious folders.
- Make enable and disable idempotent for already enabled or disabled Skill Installations.
- Report conflicts when active and disabled copies both exist. Do not repair conflicts in v1.
- Support `--dry-run` for install, uninstall, enable, and disable. Dry runs report confirmation requirements instead of prompting.
- Support `--verbose` for resolver command details, temporary workspace paths, and resolver stdout/stderr.
- Support `list --json`; defer JSON output for write commands.
- Build the TUI after the core CLI commands, using the same scanner and lifecycle operations rather than duplicating behavior.

Proposed modules:

- **Integration registry/path resolver**: defines supported Agent Integrations, production roots, activation checks, and test-injected roots.
- **Filesystem State scanner**: reads active and disabled locations, classifies state, reads lock metadata where present, and detects suspicious folders.
- **Skill artifact resolver**: manages Ephemeral Resolution Workspace lifecycle, invokes the packaged `skills` CLI, and returns the Skill Identity plus Resolved Skill Artifact.
- **Lifecycle operations**: implements install, uninstall, enable, and disable as pure business operations over target roots, prompts, dry-run mode, and resolver results.
- **Prompt/confirmation layer**: owns Interactive Target Selection, `--yes`, and dry-run prompt suppression.
- **CLI adapter**: parses commands and flags, invokes core operations, and formats human or JSON output.
- **TUI adapter**: renders Codex/Claude tabs and delegates state transitions to lifecycle operations.

## Testing Decisions

- Tests should assert external behavior and filesystem results, not private implementation details.
- Test with fake integration roots rather than real Xcode paths.
- Heavily test the Integration registry/path resolver activation behavior, including missing roots and subdirectory creation inside activated roots.
- Heavily test the Filesystem State scanner across enabled, disabled, conflict, uninstalled, suspicious, no-lock, and unknown-provenance states.
- Heavily test lifecycle operations for install, uninstall, enable, disable, idempotency, confirmation requirements, dry-run behavior, and partial success.
- Test resolver cleanup with a fake resolver that can succeed, fail, and produce malformed artifacts.
- Test that install resolves once and applies the same artifact to both selected integrations.
- Test that unrelated Skill Folders and unrelated integration-root files are preserved.
- Test symlink rejection in resolved artifacts.
- Test that no files are left in the command's current working directory after install.
- Test CLI adapter behavior for command parsing, target flag semantics, output status, and `list --json`.
- Test the TUI lightly with smoke coverage for tab display and toggle dispatch. Do not overfit tests to terminal rendering details.
- Do not test the internals of the upstream `skills` package. Treat it as an external Skill Source Resolver behind a fakeable process boundary.

## Out of Scope

- Managing global Codex skills, Claude Code skills, project-local skills, or arbitrary non-Xcode skill locations.
- Creating or activating missing Xcode Agent Integration roots.
- Configurable production integration paths.
- Importing undocumented internals from the `skills` package.
- Installing multiple Skill Specs in one command.
- Uninstalling multiple Skill Identities in one command.
- Updating all installed skills.
- Conflict repair commands.
- Installing from the TUI.
- Uninstalling from the TUI.
- JSON output for write commands.
- Deep schema validation of `SKILL.md` beyond minimal artifact guardrails.

## Further Notes

- ADR-0001 records the decision to use the packaged `skills` CLI as the resolver boundary.
- ADR-0002 records the decision to hardcode Xcode integration locations in v1.
- The TUI should be built after core command behavior is implemented and tested.
- The first implementation should prioritize filesystem safety, predictable target behavior, and clear reporting over breadth of commands.
