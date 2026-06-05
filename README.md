# xcode-skills

Manage Agent Skills for Xcode's Coding Assistant integrations.

Xcode reads skills from fixed Codex and Claude locations. Skills installed for other tools, global agent environments, or project-local folders are not automatically available to Xcode. `xcode-skills` installs and manages existing Agent Skills for Xcode only.

## Scope

`xcode-skills` manages:

- Codex: `~/Library/Developer/Xcode/CodingAssistant/codex`
- Claude: `~/Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig`

Because Xcode read agent skills exclusively in these 2 folders. [Apple documenentation.](https://developer.apple.com/documentation/Xcode/setting-up-coding-intelligence#Customize-the-Claude-Agent-and-Codex-environments)

It does not manage global Codex skills, Claude Code skills, project-local skills, or arbitrary skill folders.

Xcode must activate an integration first. This tool will not create missing integration roots, but it can create skill-management subdirectories inside an activated root.

## Install

We suggest installing this globally so that you can easily add skills to Xcode:

```sh
npm install -g xcode-skills
```

From this repo:
Clone the repo, cd the root folder.

```sh
npm install
npm run build
npm link

```

## Find skills with `npx skills find` and install with xcode-skills

Find skills using `npx skills find`, e.g.

```sh
npx skills find swiftui
```

then copy the skills id `<owner/repo@skill>` and pass it to `xcode-skills install`

```sh
xcode-skills install twostraws/swiftui-agent-skill@swiftui-pro
```

## Find skills on `skills.sh` and install with xcode-skills

on [skills.sh](https://www.skills.sh), search and click the skills you find. Then click the "copy" buttoon for the installation. Next pass the whole thing to `xcode-skills install`, with or whout quotes.

```sh
xcode-skills install npx skills add https://github.com/mattpocock/skills --skill grill-with-docs
xcode-skills install "npx skills add https://github.com/mattpocock/skills --skill grill-with-docs"
```

## Manage TUI

`xcode-skills manage` opens a keyboard-only management view.

Controls:

- `Tab`: switch Codex/Claude tab
- `Up` / `Down` or `k` / `j`: move selection
- `Space` / `Enter`: toggle enabled/disabled for the selected skill
- `u`: uninstall the selected skill after y/N confirmation
- `q`: quit

The TUI shows inactive integrations, conflicts, and suspicious folders. It can uninstall visible skills after confirmation, but it does not install skills.

## Commands

```sh
xcode-skills install <skill-spec>
xcode-skills uninstall <skill-name>
xcode-skills enable <skill-name>
xcode-skills disable <skill-name>
xcode-skills list
xcode-skills manage
```

Write commands accept:

```sh
--target codex|claude|both
--yes
--dry-run
--verbose
```

If `--target` is omitted for a write command, `xcode-skills` prompts for Codex, Claude, or both. The prompt defaults to `both` when you press Enter.

`list` is read-only, does not prompt by default, and supports:

```sh
--target codex|claude|both
--json
```

## Examples

Install a skill for Codex:

```sh
xcode-skills install mattpocock/skills/skills/engineering/diagnose --target codex
```

Install for both integrations:

```sh
xcode-skills install mattpocock/skills/skills/engineering/diagnose --target both
```

List installed skills:

```sh
xcode-skills list
```

Machine-readable list output:

```sh
xcode-skills list --json
```

Disable and re-enable a skill:

```sh
xcode-skills disable diagnose --target codex
xcode-skills enable diagnose --target codex
```

Uninstall a skill:

```sh
xcode-skills uninstall diagnose --target both
```

Preview a write operation:

```sh
xcode-skills uninstall diagnose --target codex --dry-run
```


## State Model

Enabled skills live at:

```text
<integration-root>/skills/<skill-name>/
```

Disabled skills are preserved offline at:

```text
<integration-root>/.xcode-skills/disabled/<skill-name>/
```

States:

- `enabled`: active Skill Folder exists
- `disabled`: disabled Skill Folder exists
- `conflict`: active and disabled copies both exist
- `suspicious`: a discovered folder lacks `SKILL.md`
- `not-installed`: neither active nor disabled copy exists

`disable` is reversible offline. `uninstall` removes both enabled and disabled copies for the selected target integration.

## Resolver

`xcode-skills` depends on the `skills` npm package and invokes its packaged CLI as the Skill Source Resolver. It resolves a Skill Spec once in a temporary workspace, uses copy mode, then copies the resolved Skill Folder into the selected Xcode integration locations.

The temporary workspace is deleted after the operation, including failure and dry-run cases.

## Safety

`xcode-skills` only touches paths for the selected skill:

```text
skills/<skill-name>/
.xcode-skills/disabled/<skill-name>/
```

It preserves unrelated Skill Folders, Xcode files, and user files.

The tool requires confirmation before overwriting or deleting no-lock/manual folders. Use `--yes` to bypass confirmation in automation.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```

The test suite uses fake integration roots and does not touch real Xcode directories.
