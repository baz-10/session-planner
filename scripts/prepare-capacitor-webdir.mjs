import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const capacitorServerUrl = process.env.CAPACITOR_SERVER_URL;
const allowPlaceholderWebDir = process.env.CAPACITOR_ALLOW_PLACEHOLDER_WEBDIR === '1';
const outDir = resolve(process.cwd(), 'out');
const indexPath = resolve(outDir, 'index.html');

if (!capacitorServerUrl && !allowPlaceholderWebDir) {
  throw new Error(
    'CAPACITOR_SERVER_URL is required before syncing the native app. Set CAPACITOR_ALLOW_PLACEHOLDER_WEBDIR=1 only for local native shell validation.'
  );
}

mkdirSync(outDir, { recursive: true });

writeFileSync(
  indexPath,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Session Planner</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f9fc;
        color: #0f1f33;
      }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #f7f9fc;
      }
      main {
        max-width: 420px;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        background: #ffffff;
        padding: 28px;
        box-shadow: 0 20px 50px rgba(15, 31, 51, 0.1);
      }
      h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
      }
      p {
        margin: 12px 0 0;
        color: #64748b;
        line-height: 1.55;
      }
      code {
        color: #0f766e;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Session Planner</h1>
      <p>
        Capacitor web assets are prepared. For the live native app, set
        <code>CAPACITOR_SERVER_URL</code> to the deployed Next.js app before syncing.
      </p>
    </main>
  </body>
</html>
`,
  'utf8'
);

console.log(`Prepared Capacitor webDir at ${outDir}`);
