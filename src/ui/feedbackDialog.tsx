import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { deviceInfo, MAX_LENGTH, sendFeedback, type FeedbackContext, type SendResult } from '../feedback/feedback';
import { lang, t } from '../i18n';

/** Game data for the email; version, language and device are added here. */
export type FeedbackGameInfo = Pick<FeedbackContext, 'level' | 'mode' | 'result'>;

/** The text being written survives closing and opening the dialog again. */
let draft = '';

function statusText(result: SendResult): string {
  const f = t.feedbackForm;
  switch (result) {
    case 'tooShort': return f.tooShort;
    case 'tooLong': return f.tooLong(MAX_LENGTH);
    case 'wait': return f.wait;
    case 'error': return f.error;
    case 'sent': return f.sent;
  }
}

/** Feedback: one text field and Send. The message goes to the developer's email (Web3Forms). */
export function FeedbackDialog({ info, onClose }: { info: FeedbackGameInfo; onClose: () => void }) {
  const f = t.feedbackForm;
  const titleId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState(draft);
  const [trap, setTrap] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<SendResult | null>(null);
  const sent = status === 'sent';

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { if (sent) closeRef.current?.focus(); }, [sent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const ctx: FeedbackContext = { version: __APP_VERSION__, language: lang(), ...info, ...deviceInfo() };
    const result = await sendFeedback(text, ctx, trap);
    setSending(false);
    setStatus(result);
    if (result === 'sent') { draft = ''; setText(''); }
  };

  return (
    <div className="title-backdrop" onClick={onClose}>
      {/* Keys typed here never reach the game's shortcuts (Delete, 1-4, Enter). */}
      <div className="title-dialog title-panel feedback" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}>
        <h2 id={titleId}>{f.title}</h2>
        {sent ? (
          <>
            <p className="feedback-status ok" role="status">{statusText('sent')}</p>
            <button ref={closeRef} className="title-close" onClick={onClose}>{t.landing.close}</button>
          </>
        ) : (
          <form className="feedback-form" noValidate onSubmit={submit}>
            <p className="feedback-intro">{f.intro}</p>
            <textarea ref={textRef} rows={5} maxLength={MAX_LENGTH} aria-label={f.label} placeholder={f.placeholder} value={text}
              onChange={e => { draft = e.target.value; setText(e.target.value); setStatus(null); }} />
            <input className="feedback-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={e => setTrap(e.target.value)} />
            <p className="feedback-note">{f.note}</p>
            {status && <p className="feedback-status warn" role="status">{statusText(status)}</p>}
            <div className="feedback-foot">
              <span className="feedback-count">{text.length}/{MAX_LENGTH}</span>
              <button type="button" className="link-button" onClick={onClose}>{t.levelSelect.cancel}</button>
              <button type="submit" className="title-close" disabled={sending}>{sending ? f.sending : f.send}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** A button that opens the Feedback dialog; `info` is read when it opens. */
export function FeedbackButton({ info, className = 'back' }: { info: () => FeedbackGameInfo; className?: string }) {
  const [open, setOpen] = useState<FeedbackGameInfo | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={buttonRef} type="button" className={className} onClick={() => setOpen(info())} aria-haspopup="dialog">{t.feedback}</button>
      {open && <FeedbackDialog info={open} onClose={() => { setOpen(null); buttonRef.current?.focus(); }} />}
    </>
  );
}
