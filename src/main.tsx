import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './ui/styles.css';
import { App } from './ui/App';
import { loadAnalytics } from './analytics/analytics';
import { lang, onLangChange } from './i18n';

loadAnalytics();

/** A language change remounts the app, so every text and level is read again in the new language. */
function Root() {
  const current = useSyncExternalStore(onLangChange, lang);
  return <App key={current} />;
}

createRoot(document.getElementById('root')!).render(<Root />);
