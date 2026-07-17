#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 10)) {
    console.error(`setup: Node >=22.10 is required — install via nvm (nvm install 22 && nvm use 22) or nodejs.org; found ${process.versions.node}`);
    process.exit(1);
  }
'

if [ ! -f .env.local ]; then
  cp config/example.env .env.local
  echo "setup: created .env.local from config/example.env"
else
  echo "setup: kept existing .env.local"
fi

mkdir -p data

if git rev-parse --git-dir >/dev/null 2>&1; then
  git config core.hooksPath scripts/githooks
  echo "setup: configured scripts/githooks"
fi

echo "setup: run 'npm run doctor', then 'npm run dev'"
