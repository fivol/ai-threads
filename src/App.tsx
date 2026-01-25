/**
 * Main App component with routing
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { StoreProvider, stores } from './stores';
import { Home } from './components/Home';
import { ThreadView } from './components/ThreadView';
import { Settings } from './components/Settings';
import { ThreadSettings } from './components/ThreadSettings';
import { Starred } from './components/Starred';
import { Toast } from './components/Toast';
import './index.css';

const AppContent = observer(function AppContent() {
  const { settingsStore, threadsStore } = stores;

  // Initialize stores on mount
  useEffect(() => {
    settingsStore.load();
    threadsStore.loadThreads();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/thread/:id" element={<ThreadView />} />
        <Route path="/thread/:id/settings" element={<ThreadSettings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/starred" element={<Starred />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
});

export default function App() {
  return (
    <StoreProvider value={stores}>
      <AppContent />
    </StoreProvider>
  );
}
