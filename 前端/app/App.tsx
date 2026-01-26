import { useState } from 'react';
import { LandingPage } from '@/components/LandingPage';
import { LoginPage } from '@/components/LoginPage';
import { MainPage } from '@/components/MainPage';

type AppState = 'landing' | 'login' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');

  return (
    <div className="size-full">
      {appState === 'landing' && (
        <LandingPage onGetStarted={() => setAppState('login')} />
      )}
      {appState === 'login' && (
        <LoginPage onLogin={() => setAppState('main')} />
      )}
      {appState === 'main' && (
        <MainPage onLogout={() => setAppState('landing')} />
      )}
    </div>
  );
}