// PROTOTYPE: three radically different game-screen layouts, switchable via ?variant=A|B|C|D (or #a…#d).
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { useGame } from './game';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import { VariantA } from './variants/A';
import { VariantB } from './variants/B';
import { VariantC } from './variants/C';
import { VariantD } from './variants/D';

const VARIANTS = [
  { key: 'A', name: 'Estudio (herramienta de arquitectura)', C: VariantA },
  { key: 'B', name: 'Misión (HUD de juego)', C: VariantB },
  { key: 'C', name: 'Entrevista (conversación guiada)', C: VariantC },
  { key: 'D', name: 'Misión + C4 (B con resultados e inspector)', C: VariantD },
];

function App() {
  const fromUrl = () => (new URLSearchParams(location.search).get('variant') ?? location.hash.slice(1).toUpperCase()) || 'A';
  const [variant, setVariant] = useState(fromUrl);
  const game = useGame();
  const change = (k: string) => { history.replaceState(null, '', `#${k.toLowerCase()}`); setVariant(k); };
  const V = (VARIANTS.find(v => v.key === variant) ?? VARIANTS[0]).C;
  return (
    <>
      <ReactFlowProvider key={variant}><V g={game} /></ReactFlowProvider>
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={change} />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
