import { useState } from 'react';
import { FileText, Globe, ImageIcon, LogOut } from 'lucide-react';
import { AcademicToPaper } from '@/components/AcademicToPaper';
import { CountryReport } from '@/components/CountryReport';
import { ImageTranslation } from '@/components/ImageTranslation';

interface MainPageProps {
  onLogout: () => void;
}

type TabType = 'academic' | 'country' | 'image';

export function MainPage({ onLogout }: MainPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('academic');

  const tabs = [
    { id: 'academic' as TabType, label: '学术报告转公文', icon: FileText },
    { id: 'country' as TabType, label: '国别研究报告', icon: Globe },
    { id: 'image' as TabType, label: '图片转译', icon: ImageIcon },
  ];

  return (
    <div className="size-full flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-foreground">公文撰写系统</h1>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {activeTab === 'academic' && <AcademicToPaper />}
          {activeTab === 'country' && <CountryReport />}
          {activeTab === 'image' && <ImageTranslation />}
        </div>
      </main>
    </div>
  );
}
