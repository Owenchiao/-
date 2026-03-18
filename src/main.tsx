import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global Error:', { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>發生錯誤 / An Error Occurred</h2>
      <p>${message}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #0284c7; color: white; border: none; border-radius: 8px; cursor: pointer;">
        重新整理 / Reload
      </button>
    </div>`;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
