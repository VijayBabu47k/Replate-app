import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, StyledEngineProvider } from '@mui/material';
import { ThemeModeProvider } from './lib/themeMode';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StyledEngineProvider injectFirst>
      <ThemeModeProvider>
        <CssBaseline />
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeModeProvider>
    </StyledEngineProvider>
  </React.StrictMode>,
);
