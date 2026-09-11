#!/bin/sh
# Entrypoint for the dev container.
#
# Installs the two dependency trees into their named volumes on first run, and
# reinstalls whenever a lockfile changes, so `docker compose up` never boots on
# a stale node_modules.
set -e

REPO=/app
STATE=/state

needs_install() {
    # The volume was wiped (npm's hidden lockfile is gone) -> reinstall.
    [ -f "$REPO/gpx/node_modules/.package-lock.json" ] || return 0
    [ -f "$REPO/website/node_modules/.package-lock.json" ] || return 0
    # A lockfile changed since the last successful install -> reinstall.
    cmp -s "$REPO/gpx/package-lock.json" "$STATE/gpx-lock.json" || return 0
    cmp -s "$REPO/website/package-lock.json" "$STATE/website-lock.json" || return 0
    return 1
}

if needs_install; then
    echo "==> Installing dependencies (first run, or a lockfile changed). This takes a few minutes the first time."

    # Order matters. website depends on gpx via `file:../gpx`; npm does not
    # hoist a linked package's dependencies, so fast-xml-parser and immer only
    # ever live in gpx/node_modules. gpx's postinstall also runs tsc, which it
    # resolves from gpx/node_modules/.bin. Same order as
    # .github/workflows/deploy.yml.
    #
    # Never add --omit=optional (sharp would fall back to compiling libvips
    # from source on this slim image) and never set NODE_ENV=production (it
    # would drop typescript and break gpx's postinstall).
    if ! npm ci --prefix "$REPO/gpx" || ! npm ci --prefix "$REPO/website"; then
        cat >&2 <<'MSG'

==> npm ci failed.

If the error mentions the lockfile being out of sync, then gpx/package.json has
drifted from website/package-lock.json. CI uses `npm install`, which papers over
this, so the drift can sit unnoticed on main. Refresh the locks on the host and
try again:

    npm install --prefix gpx && npm install --prefix website

MSG
        exit 1
    fi

    cp "$REPO/gpx/package-lock.json" "$STATE/gpx-lock.json"
    cp "$REPO/website/package-lock.json" "$STATE/website-lock.json"
    echo "==> Dependencies ready."
fi

exec "$@"
