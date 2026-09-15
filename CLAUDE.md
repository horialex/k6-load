# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run the main load test (with request logging and dashboard)
K6_WEB_DASHBOARD=true k6 run -e LOG=True -e HOSTNAME=http://172.22.4.19 load.js

# Run without the dashboard/logging
k6 run -e HOSTNAME=http://172.22.4.19 load.js

# Run the older fixed-VU stress test
k6 run -e HOSTNAME=http://172.22.4.19 stress.js
```

Env vars: `HOSTNAME` (target server, defaults to `http://172.22.4.19`), `LANGUAGE` (URL locale
prefix, defaults to `en`), `LOG` (set to `True` to log every request's method/URL/status/duration
via `logRequest`). There is no test suite for this repo itself — `load.js`/`stress.js` are k6
scripts that exercise an external target application.

## Architecture

This is a [k6](https://k6.io) load-testing suite for a PrestaShop-based storefront, not an
application. Two independent entry points:

- **`load.js`** — the active, scenario-based script. Defines discrete HTTP actions
  (`getHomepage`, `getCategory`, `getSubCategory`, `getProductDetails`, `login`, plus stubbed
  `addProductToCart`/`searchProduct`/`autocomplete`/`updateCartQuantity`) and composes them into
  user-journey functions under "Scenarios - User Journeys" (currently `browse`; `search`,
  `addToCart`, `updateCart` are stubs). `options.scenarios` wires journeys to k6 executors — only
  `browse` is currently registered, using `ramping-vus` against the shared `LOAD_STAGES` profile.
  Add a new journey by: writing the action functions, composing them into a journey function,
  then adding an entry to `options.scenarios` with its own `exec`.
- **`stress.js`** — a simpler, single-request ramping-VU script (legacy/reference; higher target
  VU stages are commented out). Not wired into `load.js`'s scenario system.
- **`utils/utils.js`** — shared helpers: `extractSlugs` (scrapes `href`s from HTML via a CSS
  selector and returns the last path segment, e.g. `/en/12-some-category` → `12-some-category`,
  used to discover category/product slugs to click through), `getRandom` (safe random pick from
  an array, returns `null` on empty/missing), `logRequest` (gated by `LOG` env var).
- **`export.json`** — a snapshot of a previous run's k6 summary metrics (per-request-type
  `Trend`/`Rate` stats, thresholds pass/fail). Reference data, not something to edit by hand.

**Pattern for actions in `load.js`**: each action function does an HTTP call, calls `logRequest`,
records duration into its dedicated `Trend`, records failure into its dedicated `Rate`, and
`check`s for a 200 status. When adding a new action, follow this same four-step shape and register
matching `Trend`/`Rate`/threshold entries alongside the existing ones (`homepage_*`,
`category_*`, `sub_category_*`, `product_details_*`, `login_*`).

**Thresholds** in `options.thresholds` are starting-point values (`p(95) < 2000ms`,
`p(99) < 3000ms`, error rate `< 1%` per request type) — intended to be tuned once a real baseline
run has been observed, per the inline comment in `load.js`.
