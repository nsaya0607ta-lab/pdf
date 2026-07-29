import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store/AppContext';
import { registerServiceWorker } from './registerSW';
import { installPolyfills } from './lib/polyfills';
import './styles/global.css';

// pdf.js が必要とする新しい API を古いブラウザでも使えるようにする
installPolyfills();

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

// PWA（オフライン起動・ホーム画面追加）
registerServiceWorker();
