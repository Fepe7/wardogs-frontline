// Refuses to publish a web bundle built for the wrong environment. A deploy once
// shipped the local build (emulators on 127.0.0.1, project demo-frontline) to the
// public demo, which then showed no map at all.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BROWSER_DIR = new URL('../dist/web/browser/', import.meta.url);
const EXPECTED_PROJECT = 'wardogs-frontline-dev';
const FORBIDDEN = ['127.0.0.1', 'demo-frontline'];

const code = readdirSync(BROWSER_DIR)
  .filter((file) => file.endsWith('.js'))
  .map((file) =>
    readFileSync(join(BROWSER_DIR.pathname.replace(/^\/([A-Za-z]:)/, '$1'), file), 'utf8'),
  )
  .join('\n');

const problems = [
  ...(code.includes(EXPECTED_PROJECT)
    ? []
    : [`the bundle does not use the ${EXPECTED_PROJECT} project`]),
  ...FORBIDDEN.filter((value) => code.includes(value)).map(
    (value) => `the bundle contains "${value}" (local build)`,
  ),
];

if (problems.length > 0) {
  console.error(
    `Refusing to deploy the web: ${problems.join('; ')}. Run pnpm --filter @frontline/web build:dev.`,
  );
  process.exit(1);
}
console.log(`Web bundle checked: it targets ${EXPECTED_PROJECT}.`);
