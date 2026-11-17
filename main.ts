// Lumenfall — the program that hands this entry in.
//
// It copies the playable game (game/) and its screenshots (screenshots/)
// from this repository into the output directory, then writes
// dossier.json there with make.fun's buildDossier, so the dossier is
// byte for byte the one the scorer rebuilds from the same files.
//
// Usage:  MAKEFUN_OUTPUT_DIR=out node main.ts
// Without MAKEFUN_OUTPUT_DIR it writes to /output, the grader's directory.
// Node 22, standard library only, no install, no network.
import { buildDossier } from './vendor/makefun-game.ts';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy one directory tree into another, file by file, keeping the shape. */
function copyTree(fromDir: string, toDir: string): void {
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const from = join(fromDir, entry.name);
    const to = join(toDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
  }
}

function handIn(): void {
  // Start from a clean output directory so a second run writes the same bytes.
  // Clear only the CONTENTS of outDir, never outDir itself: the grader
  // mounts /output as a volume, and removing a mount point fails with
  // EBUSY ("Device or resource busy"), which used to abort the whole run.
  if (existsSync(outDir)) {
    const stat = lstatSync(outDir);
    if (!stat.isDirectory()) throw new Error(`${outDir} exists and is not a directory`);
    for (const entry of readdirSync(outDir)) {
      rmSync(join(outDir, entry), { recursive: true, force: true });
    }
  } else {
    mkdirSync(outDir, { recursive: true });
  }

  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir} (dossier.json ${dossier.length} bytes)`);
}

handIn();
