import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useThemeStore } from './stores/themeStore'
import { registerServiceWorker } from './lib/pushNotifications'

// Register the service worker (offline caching + push notification support).
// Navigating via a push-notification click posts a message here instead of
// a hard page load, so the SPA router handles it.
if ("serviceWorker" in navigator) {
  registerServiceWorker();
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "PUSH_NAVIGATE" && event.data.link && event.data.link !== window.location.pathname) {
      window.location.href = event.data.link;
    }
  });
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore(s => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
