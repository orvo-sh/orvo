# AGENTS

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
- Commit messages should follow the existing history style: conventional prefix like `feat:`, `fix:`, or `refactor:` followed by a lowercase subject.

## Server wiring

- `apps/app/src/lib/server/container.ts` is the server-side composition root. Instantiate concrete infrastructure and implementations there, then inject them into services and factories.
- Prefer dependency injection for server modules. Factories like auth should accept the dependencies they need instead of reading environment and selecting implementations internally.
- `ServerContainer` should expose only services that routes, hooks, and API handlers call directly. Do not export raw infrastructure dependencies like the email client from the container type.
- Environment-based implementation choice belongs in `container.ts`. For example, choose console vs external email providers there and inject the selected implementation into auth.
- If email templates change, regenerate `src/lib/server/email/email.generated.ts` from the `.html` templates instead of editing the generated file by hand.

## Tooling scripts

- Prefer TypeScript tooling scripts run through `vite-node` over package-local `.mjs` maintenance scripts.
- When a package has internal sync or codegen scripts, keep the `package.json` script entry aligned with the `vite-node` pattern.

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
