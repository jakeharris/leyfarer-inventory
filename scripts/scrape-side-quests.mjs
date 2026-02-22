import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeSideQuests, SOURCE_URLS } from './scrape-side-quests-lib.mjs';

const main = async () => {
  const entries = await scrapeSideQuests();

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: SOURCE_URLS,
    entries
  };

  const filename = fileURLToPath(
    new globalThis.URL('../src/data/sideQuestCatalog.snapshot.json', import.meta.url)
  );

  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  globalThis.console.log(`Wrote ${entries.length} side quests to ${filename}`);
};

main().catch((error) => {
  globalThis.console.error(error instanceof Error ? error.message : error);
  globalThis.process.exit(1);
});
