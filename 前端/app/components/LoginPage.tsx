import { useState } from 'react';
import { LogIn } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 连接到您的后端认证API
    // 这里使用模拟登录
    if (username && password) {
      onLogin();
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-primary">
            <LogIn className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="mb-2">公文撰写系统</h1>
          <p className="text-muted-foreground">请登录以继续使用</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block mb-2 text-foreground">
              账号
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              placeholder="请输入账号"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-2 text-foreground">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              placeholder="请输入密码"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 mt-6 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
