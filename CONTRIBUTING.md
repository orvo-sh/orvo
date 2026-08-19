# Contributing to Orvo

Thank you for helping improve Orvo.

## Development

Install the prerequisites listed in the README, then install workspace
dependencies:

```sh
pnpm install
```

Run the TypeScript checks and relevant tests before opening a pull request:

```sh
pnpm check-types
pnpm test
```

Go applications own their commands locally:

```sh
cd apps/ingest && make test
cd apps/agent && make test
```

Keep pull requests focused, describe the user-visible impact, and include tests
for changed behavior. Commit messages use a conventional lowercase prefix such
as `feat:`, `fix:`, `refactor:`, or `docs:`.

## Security

Report vulnerabilities privately as described in `SECURITY.md`.
