import fs from 'node:fs/promises';
await fs.mkdir('dist', { recursive: true });
for (const file of ['index.mjs', 'index.d.ts', 'client.mjs', 'adapter.mjs']) await fs.copyFile('src/' + file, 'dist/' + file);
