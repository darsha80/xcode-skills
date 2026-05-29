# xcode-skills

This context describes Agent Skills that are installed and managed for Xcode's Coding Assistant integrations by xcode-skills.

## Language

**Agent Skill**:
A reusable agent capability that can come from any supported skill source. This project does not define a new kind of skill; it installs and manages existing Agent Skills for Xcode.
_Avoid_: Xcode-only skill, IDE skill, project skill

**Agent Integration**:
An agent that Xcode can use through Coding Assistant. Each Agent Integration has its own Xcode-managed skill location.
_Avoid_: IDE, coding tool, provider, Code

**Target Agent Integration**:
The Agent Integration selected for an operation. Supported target selections are Codex, Claude, and both.
_Avoid_: source, profile, environment, Xcode version

**Interactive Target Selection**:
The prompt shown when an operation needs a Target Agent Integration and the user did not provide one. Interactive Target Selection lets the user choose Codex, Claude, or both.
_Avoid_: default both

**Activated Agent Integration**:
An Agent Integration whose Xcode-managed root location already exists. This project manages only Activated Agent Integrations and may create skill-management subdirectories inside them, but it does not create new Agent Integration roots for Xcode.
_Avoid_: configured agent, generated integration

**Xcode Skill Installation**:
An Agent Skill made available to one Agent Integration through Xcode's Coding Assistant skill location. Xcode Skill Installations are separate from global agent skills and project-local agent skills used by other tools.
_Avoid_: global skill, project skill

**Enabled Skill Installation**:
An Xcode Skill Installation that is available to Xcode through an Agent Integration.
_Avoid_: auto-invocable skill

**Disabled Skill Installation**:
An Xcode Skill Installation that is preserved by this project but is not available to Xcode through an Agent Integration.
_Avoid_: hidden from model invocation, low priority skill

**Reversible Disablement**:
A Disabled Skill Installation can become enabled again without resolving or downloading the Agent Skill again.
_Avoid_: deletion, uninstall

**Uninstalled Skill**:
An Agent Skill that has no enabled or disabled Xcode Skill Installation for a target Agent Integration.
_Avoid_: disabled skill

**Disabled Skill Store**:
The `.xcode-skills/disabled/` location beside an Agent Integration's active skill collection where Disabled Skill Installations are preserved. Each Agent Integration has its own Disabled Skill Store.
_Avoid_: global disabled store, project disabled store

**Filesystem State**:
The state inferred from an Agent Integration's active skill collection and Disabled Skill Store. xcode-skills treats Filesystem State as the source of truth instead of keeping a separate manifest.
_Avoid_: app database, install registry

**Skill Folder**:
The concrete folder for one Agent Skill inside a skill collection. A Skill Folder is copied into an Agent Integration's existing skill collection without replacing unrelated Skill Folders.
_Avoid_: skills directory, resolver output directory, temporary directory

**Skill Identity**:
The stable name assigned by the Skill Source Resolver to recognize the same Agent Skill across installs and Agent Integrations. Skill Identity determines which Skill Folder an install may replace.
_Avoid_: folder path, display label

**Skill Lock File**:
The file that records resolved metadata for one Agent Skill. A Skill Lock File is copied into the same Skill Folder as the Agent Skill it describes.
_Avoid_: project lock file, global lock file, collection lock file

**Skill Source Resolver**:
The external authority that locates and retrieves Agent Skills before they become Xcode Skill Installations. This project consumes resolved Agent Skills rather than owning skill discovery or registry behavior.
_Avoid_: skill registry, package manager

**Skill Spec**:
The user-provided reference for an Agent Skill. A Skill Spec is interpreted by the Skill Source Resolver, not by xcode-skills.
_Avoid_: package name, repository URL

**Resolved Skill Artifact**:
The concrete files for an Agent Skill after a Skill Source Resolver has retrieved it. A Resolved Skill Artifact is file-backed, not a symlink to another location.
_Avoid_: symlinked skill, resolver cache

**Ephemeral Resolution Workspace**:
A temporary location used only while resolving an Agent Skill. It must not leave files behind after the Resolved Skill Artifact has been installed.
_Avoid_: project workspace, install directory

**Codex Agent Integration**:
The Xcode Agent Integration for Codex.
_Avoid_: Code, Codex CLI

**Claude Agent Integration**:
The Xcode Agent Integration for Claude.
_Avoid_: Claude Code, Claude CLI

## Example Dialogue

Developer: "I installed this Agent Skill for Codex already. Will Xcode see it?"

Domain expert: "Only if it has an Xcode Skill Installation for the Codex Agent Integration. Xcode does not read global or project-local agent skills from other tools."

Developer: "Can this tool enable a new Agent Integration in Xcode?"

Domain expert: "No. Xcode must activate the Agent Integration first; this project only manages skills for Activated Agent Integrations."

Developer: "What happens if I do not pass a target?"

Domain expert: "xcode-skills asks which Target Agent Integration to use. Passing a target makes the operation non-interactive."

Developer: "Does disabling a skill only stop automatic model invocation?"

Domain expert: "No. A Disabled Skill Installation is not available to Xcode through that Agent Integration at all."

Developer: "Can a disabled skill be enabled again while offline?"

Domain expert: "Yes. Disablement is reversible and preserves the resolved Agent Skill for that Xcode Skill Installation."

Developer: "Is uninstalling the same as disabling?"

Domain expert: "No. Uninstalling removes the Xcode Skill Installation for the target Agent Integration; disabling preserves it for offline re-enable."

Developer: "Where does a disabled skill live?"

Domain expert: "In that Agent Integration's Disabled Skill Store, beside the active skill collection and outside Xcode's active skill discovery path."

Developer: "How does xcode-skills know what is installed?"

Domain expert: "It reads Filesystem State from each Activated Agent Integration rather than relying on a separate app database."

Developer: "Does this project know where every Agent Skill comes from?"

Domain expert: "No. A Skill Source Resolver retrieves the Agent Skill first; this project manages the Xcode Skill Installation after that."

Developer: "Does xcode-skills parse every form of skill reference?"

Domain expert: "No. The Skill Spec belongs to the Skill Source Resolver; xcode-skills only manages the resolved result."

Developer: "Can a resolved skill depend on symlinks in a temporary workspace?"

Domain expert: "No. A Resolved Skill Artifact is copied as concrete files before it becomes an Xcode Skill Installation."

Developer: "Can resolving a skill leave helper files in the directory where the command was run?"

Domain expert: "No. Resolution happens in an Ephemeral Resolution Workspace. After installation, only the selected Xcode Skill Installations should have changed."

Developer: "Should installing one Agent Skill replace the target integration's whole skills directory?"

Domain expert: "No. Installing copies that Agent Skill's Skill Folder into the target skill collection and preserves unrelated Skill Folders already there."

Developer: "What happens if that Agent Skill is already installed?"

Domain expert: "The install applies to the existing Skill Folder with the same Skill Identity and does not affect unrelated Skill Folders."

Developer: "Should installing one Agent Skill merge a lock file for the whole target skill collection?"

Domain expert: "No. The Skill Lock File belongs with the specific Skill Folder for that Agent Skill."
