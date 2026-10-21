import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import './index.css';
import { initAppUpdate } from './lib/appUpdate';
import { applyTabletFromUrl } from './lib/tablet';

applyTabletFromUrl();

// Service worker : mise en cache de l'application et des contenus, mises à jour installées à la mise en veille.
initAppUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
