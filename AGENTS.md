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
