# Hardcode Xcode integration locations

xcode-skills uses Xcode's known Coding Assistant integration locations for Codex and Claude instead of exposing configurable paths in v1. The tool exists to manage Xcode-specific skill state, and allowing arbitrary paths would blur that boundary and make it possible to manage non-Xcode skill locations by accident.
