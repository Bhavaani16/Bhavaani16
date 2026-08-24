#!/usr/bin/env bash
# Create (if needed) and push this project to github.com/Bhavaani16/policy-copilot
# Requires: GITHUB_PAT with `repo` scope
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${GITHUB_OWNER:-Bhavaani16}"
REPO="${GITHUB_REPO:-policy-copilot}"
DESC='MCP server for comparing UK car insurance policies and checking coverage scenarios with transparent, citation-backed tool use'
TOPICS='mcp,model-context-protocol,insurance,typescript,zod,claude,cursor,portfolio,ai-agents'

if [[ -z "${GITHUB_PAT:-}" ]]; then
  echo "Set GITHUB_PAT (classic PAT with repo scope) and re-run." >&2
  exit 1
fi

API="https://api.github.com"
AUTH="Authorization: Bearer ${GITHUB_PAT}"

echo "==> Checking if ${OWNER}/${REPO} exists..."
STATUS=$(curl -sS -o /tmp/repo.json -w "%{http_code}" -H "$AUTH" -H "Accept: application/vnd.github+json" \
  "${API}/repos/${OWNER}/${REPO}")

if [[ "$STATUS" == "404" ]]; then
  echo "==> Creating public repo ${OWNER}/${REPO}..."
  curl -sS -f -H "$AUTH" -H "Accept: application/vnd.github+json" \
    -X POST "${API}/user/repos" \
    -d "$(jq -n \
      --arg name "$REPO" \
      --arg desc "$DESC" \
      '{name:$name, description:$desc, homepage:"https://github.com/Bhavaani16/policy-copilot", private:false, has_issues:true, has_projects:false, has_wiki:false, auto_init:false}')" \
    > /tmp/created.json
  echo "Created: $(jq -r .html_url /tmp/created.json)"
elif [[ "$STATUS" == "200" ]]; then
  echo "==> Repo already exists: $(jq -r .html_url /tmp/repo.json)"
else
  echo "Unexpected status $STATUS:" >&2
  cat /tmp/repo.json >&2
  exit 1
fi

echo "==> Updating description, homepage, and topics..."
curl -sS -f -H "$AUTH" -H "Accept: application/vnd.github+json" \
  -X PATCH "${API}/repos/${OWNER}/${REPO}" \
  -d "$(jq -n --arg desc "$DESC" '{description:$desc, homepage:"https://github.com/Bhavaani16/policy-copilot", has_wiki:false}')" \
  > /dev/null

curl -sS -f -H "$AUTH" -H "Accept: application/vnd.github+json" \
  -X PUT "${API}/repos/${OWNER}/${REPO}/topics" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d "$(jq -n --arg t "$TOPICS" '{names: ($t | split(","))}')" \
  > /dev/null

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Staging project tree into temp git repo..."
mkdir -p "$WORKDIR"
# Copy project files (exclude node_modules / dist / .git)
shopt -s dotglob nullglob
for item in "$ROOT"/*; do
  base="$(basename "$item")"
  case "$base" in
    node_modules|dist|.git) continue ;;
  esac
  cp -a "$item" "$WORKDIR"/
done
shopt -u dotglob nullglob
cd "$WORKDIR"
git init -b main
git config user.email "bhavaanikamesh@gmail.com"
git config user.name "Bhavaani Kamesh"
git add .
git commit -m "Initial commit: policy-copilot MCP server

UK car insurance comparison MCP demo with transparent coverage checks."

REMOTE="https://x-access-token:${GITHUB_PAT}@github.com/${OWNER}/${REPO}.git"
git remote add origin "$REMOTE"

echo "==> Pushing main..."
git push -u origin main --force

echo ""
echo "Done: https://github.com/${OWNER}/${REPO}"
echo "About: ${DESC}"
echo "Topics: ${TOPICS}"
