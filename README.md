# MapleStory Equipment Upgrade Planner

A full-stack application for estimating MapleStory upgrade probabilities,
comparing expected costs, and planning equipment progression. Built with
React, Tailwind CSS, FastAPI, Python, Cython, and optional MongoDB bug reporting.

**[Open the application](https://maplestory-calculator.onrender.com)** ·
**[Explore the API](https://maplestory-calcs-1.onrender.com/docs)**

## What you can do

- Estimate Potential, Flame, and Star Force upgrade odds and expected costs.
- Compare enhancement strategies and rank upgrades for your equipment.
- Plan upgrades across equipped and spare copies, including supported transfers.
- Save equipment in your browser and import or export profiles as JSON.
- Submit a bug report through the application.

Calculators require no account. Equipment profiles stay in browser storage;
MongoDB stores submitted bug reports, not equipment profiles. Results are
estimates based on bundled data and configurable assumptions, not guarantees.
See the [calculation assumptions](backend/README.md#calculation-assumptions).

## Use the deployment

Open the application and choose a calculator, or use **Equipment upgrade** to
build a set. In Equipment setup, choose items or import a sample, then click
**Save equips**. Use **Stats & upgrades** to record rolls and compare projected
upgrades. Export JSON to back up a set or move it between browsers.

- [Sample equipment builds](examples/equipment/README.md): importable class profiles.
- [Two-copy planning guide](frontend/README.md#laddering-equipment-upgrades): spare preparation and swaps.
- [Transfer example](examples/laddering/GOLLUX_TRANSFER.md): Source of Suffering alternatives.

The backend may need to wake after inactivity. Calculation requests can wait in
a bounded queue when both default execution slots are busy. The interface shows
loading and retry messages. Use **Report a bug** to preview and submit an issue.

## Work with the repository

Clone or download the repository, then use two terminals for local development:

1. Follow [backend setup](backend/README.md#setup) to install dependencies and
   start FastAPI.
2. Follow [frontend setup](frontend/README.md#setup) to install dependencies and
   start Vite. Its development proxy forwards API requests to your local backend
   at `http://127.0.0.1:8000`.
3. Run the [backend tests](backend/README.md#tests) and
   [frontend checks](frontend/README.md#commands) for changes to the respective service.

The frontend is deployed as a static site and the API as a separate web service.
Build commands, environment variables, route rewrites, and verification are in
the [frontend deployment guide](frontend/README.md#deployment) and
[backend deployment guide](backend/README.md#deployment).

## Project layout

| Path | Purpose |
| --- | --- |
| `backend/api/` | HTTP endpoints, validation, admission queue, and bug reporting. |
| `backend/calc/` | Probability, cost, strategy, and equipment-planning engines. |
| `backend/native/` | Cython kernel for Star Force budget calculations. |
| `backend/data/` | Bundled probability tables. |
| `backend/scripts/` | Data refresh and storage verification tools. |
| `backend/tests/` | Calculator, API, queue, and integration tests. |
| `backend/examples/` | Python usage and strategy-analysis examples. |
| `frontend/src/` | React UI, Tailwind styling, hooks, and bundled equipment data. |
| `frontend/tests/` | Frontend helper and API-client tests. |
| `frontend/scripts/` | Prerendering, browser checks, and rendering benchmarks. |
| `frontend/public/` | Static images, site verification, and crawler files. |
| `examples/` | Importable equipment saves and planning examples. |

## Documentation

- [Backend README](backend/README.md): API, queue settings, calculations, tests, and data tools.
- [Frontend README](frontend/README.md): setup, deployment, routing, styling, and equipment workflows.
- [Backend test inventory](BACKEND_TESTS.txt) and [frontend test inventory](FRONTEND_TESTS.txt).
- [Performance history](PERFORMANCE_UPDATES.txt): measurements, methodology, and limitations.
- [Resolved review findings](FIXED_WARNINGS.txt): fixes and their regression coverage.
