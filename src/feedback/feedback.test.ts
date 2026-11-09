import { describe, expect, it } from 'vitest';
import { buildPayload, checkLength, COOLDOWN_MS, FEEDBACK_ENDPOINT, MAX_LENGTH, sendFeedback, waitLeft, type FeedbackContext, type SendDeps } from './feedback';

const CTX: FeedbackContext = {
  version: '1.0.0',
  language: 'en',
  level: '04-flash-sale',
  mode: 'normal',
  result: 'failed',
  browser: 'TestBrowser/1.0',
  screen: '1280×720 @2x',
};

function deps(over: Partial<SendDeps> = {}): SendDeps & { calls: { url: string; body: Record<string, string> }[]; saved: number[] } {
  const calls: { url: string; body: Record<string, string> }[] = [];
  const saved: number[] = [];
  return {
    calls,
    saved,
    key: 'test-key',
    now: () => 1_000_000,
    lastSent: () => null,
    saveSent: (n) => saved.push(n),
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as typeof fetch,
    ...over,
  };
}

describe('feedback', () => {
  it('checks the message length (spaces do not count)', () => {
    expect(checkLength('   hi   ')).toBe('tooShort');
    expect(checkLength('hello')).toBeNull();
    expect(checkLength('x'.repeat(MAX_LENGTH + 1))).toBe('tooLong');
  });

  it('allows one message per minute', () => {
    expect(waitLeft(5000, null)).toBe(0);
    expect(waitLeft(5000, 5000)).toBe(COOLDOWN_MS);
    expect(waitLeft(5000 + COOLDOWN_MS, 5000)).toBe(0);
  });

  it('puts the version, level and device in the email', () => {
    const body = buildPayload('  The WAF does nothing  ', CTX, 'k');
    expect(body).toMatchObject({ access_key: 'k', message: 'The WAF does nothing', version: '1.0.0', level: CTX.level, mode: 'normal', result: 'failed', browser: CTX.browser, screen: CTX.screen });
    expect(body.subject).toContain('v1.0.0');
  });

  it('leaves out mode and result when there is no game', () => {
    const body = buildPayload('hello there', { ...CTX, level: 'none', mode: undefined, result: undefined }, 'k');
    expect(body).not.toHaveProperty('mode');
    expect(body).not.toHaveProperty('result');
  });

  it('sends to the form service and starts the cooldown', async () => {
    const d = deps();
    expect(await sendFeedback('Great game!', CTX, '', d)).toBe('sent');
    expect(d.calls).toHaveLength(1);
    expect(d.calls[0]!.url).toBe(FEEDBACK_ENDPOINT);
    expect(d.saved).toEqual([1_000_000]);
  });

  it('sends nothing when the hidden trap field is filled (bots)', async () => {
    const d = deps();
    expect(await sendFeedback('Buy cheap stuff', CTX, 'http://spam', d)).toBe('sent');
    expect(d.calls).toHaveLength(0);
  });

  it('sends nothing during the cooldown, or when the message is too short', async () => {
    const d = deps({ lastSent: () => 1_000_000 - 1000 });
    expect(await sendFeedback('Great game!', CTX, '', d)).toBe('wait');
    expect(await sendFeedback('ok', CTX, '', deps())).toBe('tooShort');
    expect(d.calls).toHaveLength(0);
  });

  it('reports an error when the service fails or has no key', async () => {
    const failing = deps({ fetch: (async () => new Response(JSON.stringify({ success: false }), { status: 400 })) as typeof fetch });
    expect(await sendFeedback('Great game!', CTX, '', failing)).toBe('error');
    expect(failing.saved).toEqual([]);
    const offline = deps({ fetch: (async () => { throw new TypeError('offline'); }) as typeof fetch });
    expect(await sendFeedback('Great game!', CTX, '', offline)).toBe('error');
    expect(await sendFeedback('Great game!', CTX, '', deps({ key: '' }))).toBe('error');
  });
});
