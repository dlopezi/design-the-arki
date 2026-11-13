import { describe, it } from 'vitest';
import { designCost } from '../engine/simulate';
import { callNow, createGame, run, runToEnd, starsOf } from '../realtime/game';
import { allLevels } from './levels';
import { MODES, startingDesign } from './modes';

/**
 * Level tuning report, for the person writing a level: `LEVEL=<id> npm run level-report`. Skipped without LEVEL.
 * It plays the Reference Design and each starting design and prints what levels.test.ts then asks for:
 *  - the Reference Design, bought at the start, lasts the wave with exactly 2 stars (money left under the 3-star line),
 *  - and earns 3 when the users are called early (money left over the 3-star line),
 *  - every starting design, left as it is, loses.
 */
describe.runIf(process.env.LEVEL)('level report', () => {
  it(`prints the numbers for ${process.env.LEVEL}`, () => {
    const level = allLevels('en').find(l => l.id === process.env.LEVEL);
    if (!level) throw new Error(`No level "${process.env.LEVEL}". Ids: ${allLevels('en').map(l => l.id).join(', ')}`);
    const bought = () => { const s = createGame(level, level.referenceDesign); return { ...s, money: s.money - designCost(level.referenceDesign) }; };
    const plain = runToEnd(bought(), level), early = runToEnd(callNow(run(bought(), 10, level)), level);
    const [two, three] = level.play.starMoney;
    const lines = [
      `Level ${level.id} · ${level.play.wave.rps} req/s for ${level.play.wave.lengthS} s · start money $${level.play.startMoney}`,
      `Reference Design costs $${designCost(level.referenceDesign)} (the God mode build must fit in the start money)`,
      `  bought at the start : ${plain.phase}, $${Math.round(plain.money)} left, ${starsOf(plain, level)} stars (want 2), reputation ${Math.round(plain.reputation)}%`,
      `  called early        : ${early.phase}, $${Math.round(early.money)} left, ${starsOf(early, level)} stars (want 3)`,
      `  starMoney now [${two}, ${three}]; to give 2 stars plain and 3 early pick a 3-star line between $${Math.round(plain.money)} and $${Math.round(early.money)}, for example ${Math.floor((plain.money + early.money) / 2 / 10) * 10}`,
      ...MODES.filter(mode => mode !== 'god').map(mode => {
        const end = runToEnd(createGame(level, startingDesign(level, mode)), level);
        return `  ${mode.padEnd(6)} start, unchanged: ${end.phase} (want lost), reputation ${Math.round(end.reputation)}%`;
      }),
    ];
    console.log(`\n${lines.join('\n')}\n`);
  });
});
