#!/bin/sh
# Installs the enforcement layer — run once per clone, AFTER the initial commit
# (the pre-commit hook would otherwise reject the scaffold's own first commit).
# Constitution: enforcement lives below the harness (CLAUDE.md).
set -eu
cd "$(dirname "$0")/.."
git config core.hooksPath scripts/githooks
chmod 444 vision.md CLAUDE.md docs/architecture.md
echo "bootstrap: core.hooksPath = $(git config core.hooksPath)"
echo "bootstrap: read-only 444 -> vision.md CLAUDE.md docs/architecture.md"
