import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/main.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthProvider';

/** En GitHub Pages, Vite define BASE_URL = /repo/; React Router necesita basename sin barra final. */
const baseUrl = import.meta.env.BASE_URL ?? '/';
const routerBasename =
  baseUrl === '/' || baseUrl === '' ? undefined : baseUrl.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
