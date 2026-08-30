import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import { THEME } from './config/theme.config';
import { buildThemeVars } from './config/theme-utils';

// 主题覆盖层：在 createRoot 之前把 THEME 派生值写入 :root（tokens.css 之后生效，render 前完成，无 FOUC）
const themeVars = buildThemeVars(THEME);
const rootEl = document.documentElement;
for (const [key, value] of Object.entries(themeVars)) {
  rootEl.style.setProperty(key, value);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
