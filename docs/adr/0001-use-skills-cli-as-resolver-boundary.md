# Use the skills CLI as the resolver boundary

xcode-skills depends on the `skills` package but invokes its packaged CLI instead of importing internal modules. The package currently exposes CLI binaries but no documented library API, so using the CLI preserves upstream resolver behavior while keeping xcode-skills pinned to a dependency version through its own package lock.
