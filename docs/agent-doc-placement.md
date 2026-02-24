# Docs vs AGENTS Guide

This is your document for deciding where guidance belongs.

## Put It in `AGENTS.md` When

This is your document for always-on behavior. Put guidance here when the agent should apply it on
nearly every turn without deciding whether it is relevant.

- Code style and quality defaults.
- Naming conventions.
- Change-scope defaults for implementation work.
- Safety boundaries the agent should always remember.
- A compact index of deeper docs to open when needed.

If a rule should be in the agent's head all the time, it belongs in `AGENTS.md`.

## Put It in `docs/*` When

This is your document set for specific concepts, systems, and workflows. Put guidance here when it
is relevant only for certain tasks.

- Architecture decisions and system boundaries.
- API contracts and auth/session specifics.
- Etsy bridge runbooks and endpoint-specific implementation details.
- Database query/migration procedures.
- Logging, event taxonomy, UX specs, and operational runbooks.

If the agent should load it only when working in that area, it belongs in `docs/*`.

## How to Decide Quickly

1. Ask: "Should I remember this on almost every task?"
2. If yes, put it in `AGENTS.md`.
3. If no, put it in the most specific `docs/<topic>.md`.
4. Keep `AGENTS.md` short; move details into docs and link them from the index.

## Authoring Pattern

- `AGENTS.md`: short, durable, always-on rules.
- `docs/*`: deeper reference material, scoped by domain.
- Prefer one focused doc per concept over broad catch-all process docs.
