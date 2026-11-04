import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './ui/styles.css';
import { App } from './ui/App';
import { loadAnalytics } from './analytics/analytics';

loadAnalytics();

createRoot(document.getElementById('root')!).render(<App />);
