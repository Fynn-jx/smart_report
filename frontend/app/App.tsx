import { useState, useEffect } from 'react';
import { LandingPage } from '@/components/LandingPage';
import { LoginPage } from '@/components/LoginPage';
import { MainPage } from '@/components/MainPage';

type AppState = 'landing' | 'login' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [initialDocId, setInitialDocId] = useState<string | undefined>();
  const [initialMode, setInitialMode] = useState<string | undefined>();

  useEffect(() => {
    // 检查是否已登录
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    // 检查 URL 参数，如果有 doc_id 和 mode 参数，说明是从文档库跳转过来的
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc_id');
    const mode = params.get('mode');

    if (docId && mode) {
      // 清除 URL 参数，避免刷新后重复处理
      window.history.replaceState({}, '', '/');
      setInitialDocId(docId);
      setInitialMode(mode);
    }

    // 如果已登录或者有跳转参数，直接跳转到 main
    if (isLoggedIn === 'true' || (docId && mode)) {
      setAppState('main');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setAppState('landing');
    setInitialDocId(undefined);
    setInitialMode(undefined);
  };

  return (
    <div className="size-full">
      {appState === 'landing' && (
        <LandingPage onGetStarted={() => setAppState('login')} />
      )}
      {appState === 'login' && (
        <LoginPage onLogin={() => setAppState('main')} />
      )}
      {appState === 'main' && (
        <MainPage onLogout={handleLogout} initialDocId={initialDocId} initialMode={initialMode} />
      )}
    </div>
  );
}