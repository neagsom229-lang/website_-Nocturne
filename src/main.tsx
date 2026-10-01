import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';

import './styles/tailwind.css';
import './styles/theme.css';
import './styles/design-system.css';
import './styles/base.css';
import './styles/cover.css';
import './styles/app.css';
import './styles/music.css';
import './styles/podcast.css';
import './styles/diary.css';
import './styles/dating.css';
import './styles/landing.css';
import './styles/auth.css';
import './styles/workspace.css';

import { App } from './App';
import { ToastProvider } from './components/Toast';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
