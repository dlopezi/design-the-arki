import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Glossary words (GLOSSARY.md, the `_Avoid_` lines) as a deterministic check: a mechanical slip is caught here, not in review.
 *
 * Most `_Avoid_` words are ordinary English ("run", "test", "node"), so only the unambiguous ones are checked.
 * A rule is a **ratchet** when old code already breaks it: each file may use the word at most as often as its
 * `baseline` says. A new use fails; so does removing one without lowering the baseline, so the debt only shrinks.
 * A rule with an empty baseline is strict.
 */
type Rule = {
  /** The glossary entry the rule comes from (`**Term**` in GLOSSARY.md). */
  term: string;
  /** What to write instead. */
  use: string;
  avoid: RegExp;
  /** Which files the rule reads. */
  files: (path: string) => boolean;
  baseline: Record<string, number>;
};

const isCode = (p: string) => /\.(ts|tsx|json)$/.test(p) && !p.endsWith('src/glossary.test.ts');
/** Player-facing words live here: a level is shown to players as a "mission", so only code may not say it. */
const playerText = new Set(['src/i18n/en.ts', 'src/i18n/es.ts', 'src/levels/text.es.ts']);

const rules: Rule[] = [
  {
    term: 'Read Replica', use: '"Read Replica" in full, never "replica" alone', files: isCode,
    avoid: /(?<!Read )(?<![\p{L}])replicas?(?![\p{L}])/giu,
    baseline: { 'src/catalog/catalog.ts': 2, 'src/i18n/en.ts': 2, 'src/i18n/es.ts': 1, 'src/i18n/manual.test.ts': 3, 'src/levels/15-too-many-reads.json': 8, 'src/levels/16-just-saved-not-there.json': 9, 'src/levels/20-release-day.json': 9, 'src/levels/levels.test.ts': 7, 'src/realtime/flow.ts': 2, 'src/realtime/game.test.ts': 12 },
  },
  {
    term: 'Read Replica', use: '"Read Replica" in full, never "réplica" alone', files: isCode,
    avoid: /(?<![\p{L}])réplicas?(?![\p{L}])/giu,
    baseline: { 'src/i18n/es.ts': 6, 'src/levels/text.es.ts': 1 },
  },
  {
    term: 'Level', use: '"level" in code and docs ("mission" is only what the player reads)', files: p => isCode(p) && !p.endsWith('.json') && !playerText.has(p),
    avoid: /\bmissions?\b/gi,
    baseline: { 'src/progress/progress.test.ts': 1, 'src/progress/progress.ts': 2, 'src/ui/App.tsx': 5, 'src/ui/levelSelect.tsx': 7, 'src/ui/modePicker.tsx': 2, 'src/ui/play/PlayScreen.tsx': 8, 'src/ui/routes.ts': 1, 'e2e/async.spec.ts': 12, 'e2e/helpers.ts': 1, 'e2e/home.spec.ts': 9, 'e2e/landing.spec.ts': 3, 'e2e/modes.spec.ts': 5, 'e2e/play.spec.ts': 3, 'e2e/tutorial.spec.ts': 2 },
  },
  {
    term: 'Manual', use: '"Manual" (Field Manual and Building Archive are old names)', files: isCode,
    avoid: /Field Manual|Building Archive/gi,
    baseline: { 'src/archive/archive.test.ts': 1, 'src/archive/archive.ts': 1, 'src/i18n/en.ts': 2, 'src/ui/App.tsx': 1, 'src/ui/manual.tsx': 1, 'src/ui/play/PlayScreen.tsx': 1, 'src/ui/routes.ts': 1, 'e2e/home.spec.ts': 1, 'e2e/landing.spec.ts': 1 },
  },
  { term: 'Replication Lag', use: '"Replication Lag" (not "staleness")', files: isCode, avoid: /staleness/gi, baseline: {} },
  { term: 'Read-your-writes', use: '"Read-your-writes" (not "fresh read" or "strong read")', files: isCode, avoid: /fresh read|strong read/gi, baseline: {} },
  { term: 'Hot Shard', use: '"Hot Shard" (not "hotspot")', files: isCode, avoid: /hotspot|overloaded node/gi, baseline: {} },
  { term: 'Shard Key', use: '"Shard Key" (not "partition key" or "split key")', files: isCode, avoid: /partition key|split key/gi, baseline: {} },
  { term: 'Object Storage', use: '"Object Storage" (not "file server" or "blob store")', files: isCode, avoid: /file server|blob store/gi, baseline: {} },
  { term: 'Worker', use: '"Worker" (not "job runner")', files: isCode, avoid: /job runner/gi, baseline: {} },
  { term: 'Backlog', use: '"Backlog" (not "queue length")', files: isCode, avoid: /queue length/gi, baseline: {} },
];

const root = process.cwd();
const files = ['src', 'e2e'].flatMap(dir => readdirSync(`${root}/${dir}`, { recursive: true, encoding: 'utf8' }).map(p => `${dir}/${p.replaceAll('\\', '/')}`)).filter(isCode);
const countIn = (rule: Rule) => {
  const counts: Record<string, number> = {};
  for (const file of files.filter(rule.files)) {
    const n = readFileSync(`${root}/${file}`, 'utf8').match(rule.avoid)?.length ?? 0;
    if (n) counts[file] = n;
  }
  return counts;
};

describe('glossary words', () => {
  const glossary = readFileSync(`${root}/GLOSSARY.md`, 'utf8');

  it('every rule comes from an entry of GLOSSARY.md', () => {
    for (const { term } of rules) expect(glossary, term).toContain(`**${term}**`);
  });

  for (const rule of rules) {
    it(`${rule.term}: ${rule.use}`, () => {
      const counts = countIn(rule);
      const worse = Object.entries(counts).filter(([file, n]) => n > (rule.baseline[file] ?? 0)).map(([file, n]) => `${file} uses it ${n} times, the baseline allows ${rule.baseline[file] ?? 0}`);
      expect(worse, `New use of a word GLOSSARY.md says to avoid. Use ${rule.use}.`).toEqual([]);
      const better = Object.entries(rule.baseline).filter(([file, n]) => (counts[file] ?? 0) < n).map(([file, n]) => `${file}: baseline ${n}, now ${counts[file] ?? 0}`);
      expect(better, 'The debt went down: lower this rule\'s baseline in src/glossary.test.ts.').toEqual([]);
    });
  }
});
