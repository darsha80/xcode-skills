# xcode-skills v1 Spec

xcode-skills installs and manages existing Agent Skills for Xcode's Coding Assistant integrations. It does not manage global Codex skills, Claude Code skills, project-local skills, or arbitrary skill folders.

## Integration Locations

xcode-skills manages only Activated Agent Integrations: integration roots that Xcode has already created.

- Codex root: `~/Library/Developer/Xcode/CodingAssistant/codex`
- Claude root: `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig`
- Active skills: `<integration-root>/skills/<skill-name>/`
- Disabled skills: `<integration-root>/.xcode-skills/disabled/<skill-name>/`

xcode-skills must not create missing integration roots. It may create `skills/` and `.xcode-skills/disabled/` inside an activated root when needed.

## Resolver Boundary

xcode-skills depends on the `skills` npm package and invokes its packaged CLI as the Skill Source Resolver. It does not import undocumented internal modules from `skills`.

Install resolution:

- Accept one opaque Skill Spec.
- Resolve once in an Ephemeral Resolution Workspace.
- Invoke the resolver in copy mode.
- Use the resolver-assigned Skill Identity.
- Copy the resulting Skill Folder into each selected integration.
- Delete the Ephemeral Resolution Workspace even on failure.

The resolver output is treated as an opaque artifact, with only minimal guardrails:

- the resolved skill must be a real directory
- it must contain root `SKILL.md`
- it must not contain symlinks

## Commands

### `xcode-skills install <skill-spec>`

Installs or updates one Agent Skill.

Target behavior:

- `--target codex`: non-interactive, Codex only
- `--target claude`: non-interactive, Claude only
- `--target both`: non-interactive, both integrations
- no `--target`: prompt for Codex, Claude, or both, defaulting to `both` on Enter

If `both` is selected and one integration is not activated, install into activated integrations and warn about missing integrations. If a single explicit target is not activated, fail.

Installing a skill makes it enabled. If a disabled copy for the same Skill Identity exists, remove or supersede it so the final state is unambiguous. If an enabled manual/no-lock folder would be overwritten, require confirmation or `--yes`.

### `xcode-skills uninstall <skill-name>`

Removes one Skill Identity from selected integrations. It removes both enabled and disabled copies for each selected integration.

Uninstall is destructive. If deleting a no-lock or suspicious folder, require confirmation or `--yes`, and show exact paths to be removed.

Absent skills are idempotent success with a `not installed` status. Missing explicit target integrations are failures.

### `xcode-skills enable <skill-name>`

Moves one disabled Skill Installation back into the active `skills/` directory for selected integrations.

Already enabled is idempotent success. If both active and disabled copies exist, report conflict and do not toggle.

### `xcode-skills disable <skill-name>`

Moves one enabled Skill Installation into that integration's Disabled Skill Store.

Already disabled is idempotent success. Disablement must be reversible offline. Suspicious folders without `SKILL.md` are not eligible for normal disable.

### `xcode-skills list`

Read-only filesystem inspection.

Default behavior lists all activated integrations without prompting. `--target codex|claude|both` filters the output. `--json` is supported in v1.

List shows enabled, disabled, conflict, suspicious, and unknown-provenance states. No-lock skills are shown with unknown source metadata, not treated as invalid.

### `xcode-skills manage`

TUI for inspecting and toggling enabled/disabled state. It is built after the core CLI commands and reuses the same lifecycle operations.

TUI behavior:

- show Codex and Claude tabs
- inactive integration tabs say not activated in Xcode
- keyboard-first controls, mouse support if cheap
- write changes immediately
- show conflicts but do not repair them
- no install or uninstall in v1

## Shared Flags

Write commands support:

- `--target codex|claude|both`
- `--yes` to bypass confirmation prompts
- `--dry-run` to report intended changes without modifying Xcode integration roots
- `--verbose` to show resolver command, temporary workspace, stdout, and stderr

`install --dry-run` still invokes the resolver so it can report the actual Skill Identity and intended copy operations, then cleans up the temporary workspace.

Dry runs do not prompt; they report where confirmation would be required.

## State Model

Filesystem State is the source of truth. xcode-skills does not maintain a separate manifest or database.

State per Skill Identity and Agent Integration:

- `enabled`: active Skill Folder exists
- `disabled`: disabled Skill Folder exists
- `conflict`: both active and disabled folders exist
- `uninstalled`: neither exists
- `suspicious`: a discovered folder lacks `SKILL.md`

If a conflict exists, active state wins in terms of Xcode availability, but xcode-skills reports `conflict` and avoids silent deletion.

## Safety Rules

xcode-skills only touches paths for the selected Skill Identity:

- `skills/<skill-name>/`
- `.xcode-skills/disabled/<skill-name>/`

It preserves unrelated Skill Folders, Xcode files, and user files. It preserves file permissions when copying. It rejects symlinks in resolved artifacts.

## Deferred

Not in v1:

- configurable integration paths
- update-all
- multi-skill install or uninstall
- write-command JSON output
- conflict repair command
- installing from the TUI
- uninstalling from the TUI
