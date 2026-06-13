# AGENTS

Read this file before making changes in this repo. Treat the instructions here as required defaults, not suggestions.

This repo is a Svelte monorepo with shared UI in `packages/components` and product apps in `apps/*`.

## Default stack

- Use SvelteKit, Tailwind CSS v4, and the shared shadcn-svelte package in `packages/components`.
- Prefer existing components from `@repo/components/ui/*` before inventing one-off UI.
- Keep DB and infra packages in `packages/*`, not inside individual apps.

## Styling direction

- Aim for a product UI that feels simple, polished, and deliberate.
- Favor clean spacing, soft surfaces, rounded corners, thin borders, and restrained color.
- Keep the interface feeling calm and deliberate. Do not over-design basic product screens.
- Avoid purple-heavy palettes, noisy gradients, glassmorphism, and novelty effects unless the task explicitly calls for them.
- Prefer neutral foundations with one strong primary accent.
- Typography should feel intentional. Default to `Inter Variable` unless the existing app already establishes something else.
- Prefer visual confidence through proportion, spacing, and hierarchy rather than decoration.
- The best default is understated and sharp: compact forms, readable density, and controls that look production-ready without extra styling.
- Button loading states should preserve the label text. Do not swap labels like `Sign up` to `Signing up...`; keep the text stable and show loading with a spinner instead.
- If a button includes an icon, mark that icon with `data-slot="button-icon"` so shared loading states can replace the icon with the spinner without shifting the label.

## CSS structure

- Each app should own its Tailwind entrypoint at `src/app.css`.
- Import shared package styles from the app entrypoint, not from a route-local stylesheet.
- When an app consumes workspace UI packages, add explicit `@source` lines for those packages in `src/app.css`.
- Do not rely on Tailwind auto-detection for workspace packages alone.
- Keep design tokens in CSS variables and prefer extending the shared token system over ad hoc color literals.

## Component usage

- Reuse `@repo/components/styles.css` and `@repo/components/ui/*` as the default styling system.
- If shadcn components are added, keep package exports synced so imports stay in the form `@repo/components/ui/button`.
- Import components by their named export form, for example `import { Button } from '@repo/components/ui/button'`.
- Do not use namespace imports for simple primitives like `Button`, `Input`, `Card`, `Badge`, `Label`, `Textarea`, or `Avatar`.
- Prefer composing simple sections from shared primitives rather than building large custom wrappers too early.
- If a UI library component already exists, use it instead of raw `button`, `input`, `textarea`, or ad hoc form chrome.
- Treat the component library defaults as the source of truth. Add classes for layout, width, spacing, or composition first; avoid restyling the primitive itself unless there is a concrete gap.
- If a page needs custom styling, stay close to the shared token vocabulary: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-muted`, `bg-card`.
- Prefer shared button loading behavior over page-local loading label swaps or ad hoc spinner placement.

## Code style

- Use arrow functions for handlers and helpers in the app codebase unless there is a concrete reason not to.
- Use sentence case for user-facing labels, headings, actions, and menu items. Avoid Title Case unless a third-party name requires it.
- Commit messages should follow the existing history style: conventional prefix like `feat:`, `fix:`, or `refactor:` followed by a lowercase subject.
- Prefer inlining one-off values and helpers unless extraction clearly improves reuse or readability.
- Prefer inlining file-local types too. Do not introduce local `type` aliases for props, rows, or small shapes that are only used once or twice inside the same file unless the inline form is materially hard to read.
- In UI files, default to inlining one-off derived values, booleans, ids, and tiny formatting decisions directly at the use site. Do not extract `has*`, `display*`, `trend*`, or similar locals unless they are reused enough to clearly pay for themselves.
- Prefer grouping exports at the very bottom of the file (e.g., `export { x, y }`) instead of using inline exports on every member (e.g., `export const x = ...`).

## Server wiring

- `apps/app/src/lib/server/container.ts` is the server-side composition root. Instantiate concrete infrastructure and implementations there, then inject them into services and factories.
- Prefer dependency injection for server modules. Factories like auth should accept the dependencies they need instead of reading environment and selecting implementations internally.
- `ServerContainer` should expose only services that routes, hooks, and API handlers call directly. Do not export raw infrastructure dependencies like the email client from the container type.
- Environment-based implementation choice belongs in `container.ts`. For example, choose console vs external email providers there and inject the selected implementation into auth.
- If email templates change, regenerate `src/lib/server/email/email.generated.ts` from the `.html` templates instead of editing the generated file by hand.
- Prefer server-side route guardrails for auth and onboarding flows. Redirect logic for unauthenticated, unverified, or already-onboarded users should live in `+layout.server.ts` or `+page.server.ts`, not only in client navigation code.
- Keep app services in `apps/app/src/lib/server/services`, name files `*.service.ts`, export the zod input schemas from the same file, and keep remote functions thin over those schemas.
- In service files, put the service class first after imports, then exported zod input schemas, then type aliases. Keep helper schemas and type aliases to the minimum needed.
- Prefer implicit TypeScript inference in services. Do not create row/result/input type aliases when the value can be inferred clearly from zod, Drizzle, or the returned object.
- Avoid one-off private service helper methods for logic used by a single method. Keep that logic inline unless the helper is reused or materially improves readability.
- Use `genId(prefix)` from `@repo/utils` for app-generated ids. Pass prefixes without underscores, for example `genId('logv')`; the utility adds the underscore and lowercases the ULID.
- When a service creates a new resource, return `ok({ id })` unless the caller explicitly needs a richer payload.
- Returning Drizzle rows directly from services is fine. Do not add mapper functions or DTOs unless the caller needs a different shape.
- Prefer a small verb surface over CRUD-by-default. Add only the methods the product uses, for example `get*`, `create*`, and `rotate*` instead of list/revoke variants when rotation is the actual workflow.
- Service methods should take request metadata such as `organizationId` through a `context` object, not as zod input. Direct identifiers like `id` or `slug` may stay in the zod input when they are part of the user action.
- Transaction handles (`tx`) must be passed as a separate trailing parameter, never nested inside the `context` object. The standard service method signature is `method(input, context, tx?)`.
- Service classes should take dependencies through the constructor, immediately derive a child logger in the constructor, log once at method entry, validate with `safeParse` near the top, and log one failure in the catch path before returning a stable result.
- `hooks.server.ts` should create the request-scoped logger and container once per request. Routes and remote functions should call `event.locals.container.*` rather than instantiating services directly.
- Keep `src/lib/api/*.remote.ts` focused on transport only: import the service schemas, call `query(...)` or `command(...)`, pull `getRequestEvent()`, and forward into the relevant container service. Put business logic in the service, not in the remote function.
- Frontend-to-service calls should go through SvelteKit remote functions in `src/lib/api/*.remote.ts`. Keep those files thin: import the zod input schemas from the service files, then forward to `event.locals.container.*Service` with request-local auth context.
- Service input schemas should live with the service that owns the behavior, so remote functions can import the same zod schemas directly instead of duplicating request validation.
- Only add Drizzle relationships when a direct query in the codebase benefits from them. Do not add relations preemptively just because the foreign keys exist.

## Tooling scripts

- Prefer TypeScript tooling scripts run through `vite-node` over package-local `.mjs` maintenance scripts.
- When a package has internal sync or codegen scripts, keep the `package.json` script entry aligned with the `vite-node` pattern.

## Testing philosophy

- Prefer happy-path tests first, especially for the main product spine like auth, onboarding, organization selection, billing access, and app creation.
- Default to broad integration coverage that exercises the real stack end to end before adding many narrow unit tests.
- A good early test should cover as much real behavior as possible: UI, route guards, auth, DB writes, redirects, and request-scoped wiring in one flow.
- Add targeted unit or service tests when a branch-heavy rule, edge case, or failure path is too awkward, slow, or brittle to prove through the main happy-path flows.
- For app UI tests, add stable selectors up front so Playwright tests stay easy to read and durable as the interface evolves.

## Layout and page design

- Build pages with clear hierarchy, obvious spacing, and strong alignment.
- Cards, forms, auth pages, and org screens should feel compact and professional rather than flashy.
- Auth, onboarding, and organization management pages should use simple structure, sparse decoration, and library-default controls.
- Prefer one strong container, one clear heading block, and one obvious primary action over layered marketing-style composition.
- Use supporting copy sparingly. Interfaces should explain themselves mostly through structure and labels.
- Use contrast through spacing, weight, and surface changes more than through bright colors.
- Motion should be minimal and functional.

## When changing styles

- Verify that Tailwind classes are actually emitted after CSS changes. A successful type-check is not enough.
- For app-level styling issues, check the built CSS output or run the app build before assuming component code is broken.
- Preserve established patterns when editing an existing screen. Improve them, do not restyle everything opportunistically.

## Go services

- Small standalone Go apps can live under `apps/*` when they are product-facing services in the monorepo.
- Each Go app should own its own `go.mod`, `Makefile`, and runtime assets.
- For thin single-purpose binaries, prefer a root `main.go` plus one local `internal/` package over deep horizontal layering.
- Keep `main.go` limited to wiring, startup, shutdown, and dependency assembly.
- Keep HTTP handlers thin. Header parsing, body decode, and response mapping can live near the server code, but transforms and business decisions should stay in focused helpers.
- Split files by concern only as far as it helps scanning the app. Prefer files like `server.go`, `auth.go`, `postgres.go`, `nats.go`, `logs.go`, `traces.go`, `metrics.go`, and `transform*.go` over `domain/services/infra` trees for small binaries.
- Default to stdlib `net/http`, `context`, and focused dependencies. Do not introduce framework-heavy Go stacks unless there is a hard requirement.
- Use `slog` with structured fields. Log operation entry with `InfoContext`, failures with `ErrorContext`, and include counts, IDs, and dependency state where useful.
- Match the existing log tone: method-prefixed messages like `IngestTraces: ingesting traces`, no noisy debug spam, and no secrets or raw telemetry payloads in logs.
- Keep helpers inside the app-local `internal/` package by default. Only introduce a local `pkg/` if there is a real second consumer and the split clearly pays for itself.
