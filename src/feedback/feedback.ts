/**
 * Feedback: a free-text message a player sends from the game, with technical context.
 * The game has no server, so a form service (Web3Forms) turns the message into an email
 * to the owner. Its domain is allowed in the CSP (connect-src) for this reason only.
 *
 * The access key is public on purpose: it ships in the game's JS and can only send
 * emails to the owner's inbox. Spam is limited by a hidden trap field, a length range
 * and one message per minute per browser.
 */

export const FEEDBACK_ENDPOINT = 'https://api.web3forms.com/submit';
/** Web3Forms access key (sends to the owner's email). Empty: sending is off. */
export const WEB3FORMS_KEY = 'a4168522-5fbb-46df-8ba7-488da1ca3344';

export const MIN_LENGTH = 5;
export const MAX_LENGTH = 2000;
export const COOLDOWN_MS = 60_000;
const SENT_KEY = 'design-the-arki:feedback-sent';

/** Technical data attached to every message. Strings only: they go into the email as is. */
export interface FeedbackContext {
  version: string;
  language: string;
  /** "04-flash-sale", or "none" outside a level. */
  level: string;
  /** "guided" / "normal" / "hard" / "god", only inside a level. */
  mode?: string;
  /** Last run: "passed 2★" / "failed", only after a run. */
  result?: string;
  browser: string;
  screen: string;
}

export type SendResult = 'sent' | 'tooShort' | 'tooLong' | 'wait' | 'error';

export function checkLength(message: string): 'tooShort' | 'tooLong' | null {
  const n = message.trim().length;
  if (n < MIN_LENGTH) return 'tooShort';
  if (n > MAX_LENGTH) return 'tooLong';
  return null;
}

/** Milliseconds until another message may be sent (0 = now). */
export function waitLeft(now: number, lastSent: number | null): number {
  if (lastSent === null) return 0;
  return Math.max(0, lastSent + COOLDOWN_MS - now);
}

/** Body of the Web3Forms request. Every extra field shows up as a line in the email. */
export function buildPayload(message: string, ctx: FeedbackContext, key: string): Record<string, string> {
  const body: Record<string, string> = {
    access_key: key,
    subject: `Design the Arki feedback · v${ctx.version} · ${ctx.level}`,
    from_name: 'Design the Arki',
    message: message.trim(),
    version: ctx.version,
    language: ctx.language,
    level: ctx.level,
  };
  if (ctx.mode) body.mode = ctx.mode;
  if (ctx.result) body.result = ctx.result;
  body.browser = ctx.browser;
  body.screen = ctx.screen;
  return body;
}

function readLastSent(): number | null {
  try {
    const v = Number(localStorage.getItem(SENT_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function saveLastSent(now: number): void {
  try {
    localStorage.setItem(SENT_KEY, String(now));
  } catch {
    /* private mode: no cooldown, the form service still limits */
  }
}

export interface SendDeps {
  fetch: typeof fetch;
  now: () => number;
  lastSent: () => number | null;
  saveSent: (now: number) => void;
  key: string;
}

const BROWSER_DEPS: SendDeps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  lastSent: readLastSent,
  saveSent: saveLastSent,
  key: WEB3FORMS_KEY,
};

/**
 * Sends one message. `trap` is the hidden field: people never fill it, bots do.
 * A bot gets "sent" so it does not retry, but nothing is sent.
 */
export async function sendFeedback(message: string, ctx: FeedbackContext, trap = '', deps: SendDeps = BROWSER_DEPS): Promise<SendResult> {
  if (trap) return 'sent';
  const bad = checkLength(message);
  if (bad) return bad;
  if (waitLeft(deps.now(), deps.lastSent()) > 0) return 'wait';
  if (!deps.key) return 'error';
  try {
    const res = await deps.fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildPayload(message, ctx, deps.key)),
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (!res.ok || !data?.success) return 'error';
    deps.saveSent(deps.now());
    return 'sent';
  } catch {
    return 'error';
  }
}

/** Browser and screen, read when the message is sent. */
export function deviceInfo(): { browser: string; screen: string } {
  let touch = false;
  try {
    touch = window.matchMedia('(hover: none)').matches;
  } catch {
    touch = false;
  }
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  return {
    browser: navigator.userAgent,
    screen: `${window.innerWidth}×${window.innerHeight} @${dpr}x${touch ? ' · touch' : ''}`,
  };
}
