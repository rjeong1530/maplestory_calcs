# MapleStory calculator frontend

React application using Vite. Start the FastAPI server from the repository
root as described in the [project README](../README.md#quick-start), then run
the following commands from `frontend/`:

```text
npm ci
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000` during development.

- `npm run build`: production output in `dist/`.
- `npm run lint`: check JavaScript source.
- `node --test src/data/*.test.js`: run data-helper tests with Node's built-in
  test runner (there is no `npm test` script).
- `npm run preview`: preview the production build. Production API routing
  requires a reverse proxy; the development proxy is not part of the build.

## Source layout

- `src/main.jsx`: React entry point.
- `src/App.jsx`: Potential, Flames, Star Force, and Equipment tabs.
- `src/api.js`: API requests and error handling.
- `src/components/CalculatorForm.jsx`: equipment and target inputs.
- `src/components/TargetRow.jsx`: one potential target.
- `src/components/Results.jsx`: probabilities and cube estimates.
- `src/components/FlameCalculator.jsx`: flame calculator and saved equipment state.
- `src/components/StarForceCalculator.jsx`: Star Force costs and estimates.
- `src/components/EquipmentWindow.jsx`: gear selection and import/export.
- `src/components/EquipmentAnalysis.jsx`: current potential, flame, and Star Force inputs.
- `src/components/EquipmentUpgradePlan.jsx`: expected upgrade gains, costs, and rankings.
- `src/data/`: bundled GMS equipment catalog, equipment/flame/Star Force helpers,
  import/export, upgrade request construction, and `*.test.js` tests.
- `src/App.css` and `src/index.css`: application and shared styles.
- `vite.config.js`: React plugin and development `/api` proxy.

Refresh the equipment catalog from the repository root with
`.\.venv\Scripts\python.exe -m backend.scripts.fetch_equipment_data`.
This requires internet access and writes `src/data/equipment_140_250.json`
and its `.meta.json` companion. Normal development uses the bundled data.
