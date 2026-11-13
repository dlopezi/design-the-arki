import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';

// "Worker" and "Message Queue" are chapter 2 buildings (GLOSSARY.md), so the per-instance words are Concurrency and Waiting line.
describe.each([['English', en, 'Concurrency', /workers?\b|queue/i], ['Spanish', es, 'Concurrencia', /workers?\b|cola\b/i]] as const)(
  '%s: per-instance words',
  (_name, strings, concurrency, banned) => {
    const inspector = strings.inspector;
    const perInstance = [inspector.perInstanceValue(2, 4, 40), inspector.queueSize, inspector.longerQueue, inspector.shorterQueue];

    it('calls the slots of an instance Concurrency and its line the Waiting line, never workers or a queue', () => {
      for (const text of perInstance) expect(text).not.toMatch(banned);
      expect(inspector.perInstanceValue(2, 4, 40)).toContain(concurrency);
    });

    it('explains Concurrency in the app server entry of the Manual', () => {
      const { role, same } = strings.archive.buildings.appServer!;
      expect(role).toContain(concurrency);
      expect(same).toContain(concurrency);
      expect(`${role} ${same}`).not.toMatch(banned);
    });

    it('says waiting line, not queue, in the last run table', () => {
      expect(JSON.stringify(strings.lastRun)).not.toMatch(banned);
    });
  },
);
