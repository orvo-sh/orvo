# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.3 create --template minimal --types ts --add tailwindcss="plugins:none" drizzle="database:postgresql+postgresql:postgres.js+docker:no" better-auth="demo:password" --no-install apps/app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.


## Scout dashboards and token usage

Use **Dashboards → Create with Scout**, or open a dashboard and select Scout in
its header. For example: “Create and save a Scout token usage dashboard with input
and output token totals, usage over time, and a breakdown by model.” Scout edits
the visible grid and settings using revision-checked browser tools. A request for
a draft leaves it unsaved; a request to create or save persists the visible form.

The manual panel editor also supports **Traces → Input tokens / Output tokens /
Total tokens**, with model/provider filters and grouping. These measures sum
reported per-call usage; they do not average it. Input plus output is the total—do
not add the total series to those two series again. Missing usage remains absent.

Scout emits one `orvo-scout` client span per completed model step, including tool
loop steps and title generation. The spans include `gen_ai.provider.name`,
`gen_ai.request.model`, `gen_ai.response.model`, and reported
`gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, and
`gen_ai.usage.total_tokens`. `orvo.scout.purpose` distinguishes `conversation` from
`title`. Prompt and response contents are not added to these spans. No aggregate
turn span repeats those token fields. Usage spans are retained independently of
parent HTTP trace sampling, while normal self-telemetry keeps its sampler choice.

These spans use Orvo's existing self-telemetry exporter: configure `OTEL_ENDPOINT`
and `OTEL_INGESTION_KEY` and restart the app to load instrumentation. The resource
service is `orvo-app-server`. Build the dashboard in the app associated with that
ingestion key. Only newly recorded calls contain usage fields; old traces are not
backfilled. Totals describe provider-reported usage in retained telemetry, rather
than the billing credits counter.


AI usage spans also carry server-authenticated attribution: `user.id`,
`orvo.organization.id`, `orvo.app.id`, and `orvo.chat.id`. This applies to each
conversation step and title generation. Names and email addresses are excluded from Scout spans. External applications
may optionally send `user.name` as a display label alongside stable `user.id`.
Usage views should group by ID within the telemetry app and fall back to showing
the ID when no label is available; they must not depend on Orvo account lookups. Existing spans are not backfilled. These IDs
provide attribution only; dollar cost calculation and dashboard grouping by user
are separate capabilities and are not enabled by adding these attributes.
