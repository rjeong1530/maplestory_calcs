# MapleStory calculator frontend

React application using Vite. Start the FastAPI server from the repository
root as described in the [project README](../README.md#api), then run here:

```text
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000` during development.

- `npm run build`: production output in `dist/`.
- `npm run lint`: check JavaScript source.
- `npm run preview`: preview the production build. Production API routing
  requires a reverse proxy; the development proxy is not part of the build.

## Source layout

- `src/App.jsx`: options loading and calculation state.
- `src/api.js`: API requests and error handling.
- `src/components/CalculatorForm.jsx`: equipment and target inputs.
- `src/components/TargetRow.jsx`: one potential target.
- `src/components/Results.jsx`: probabilities and cube estimates.
- `src/App.css` and `src/index.css`: application and shared styles.
