import { useState } from 'react';
import { FileText, Globe, ImageIcon, LogOut, MessageCircle, Clock, Folder } from 'lucide-react';
import { AcademicToPaper } from '@/components/AcademicToPaper';
import { CountryReport } from '@/components/CountryReport';
import { ImageTranslation } from '@/components/ImageTranslation';
import { FeedbackModal } from '@/components/FeedbackModal';
import { History } from '@/components/History';
import { DocumentLibrary } from '@/components/DocumentLibrary';

interface MainPageProps {
  onLogout: () => void;
}

type TabType = 'academic' | 'country' | 'image' | 'history' | 'library';

export function MainPage({ onLogout }: MainPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('academic');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const tabs = [
    { id: 'academic' as TabType, label: '学术报告转公文', icon: FileText },
    { id: 'country' as TabType, label: '国别研究报告', icon: Globe },
    { id: 'image' as TabType, label: '图片转译', icon: ImageIcon },
    { id: 'library' as TabType, label: '文档库', icon: Folder },
    { id: 'history' as TabType, label: '历史记录', icon: Clock },
  ];

  return (
    <div className="size-full flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-25 h-25">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-foreground">中国人民银行智能公文系统</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>反馈</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </div>
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
          {activeTab === 'library' && <DocumentLibrary />}
          {activeTab === 'history' && <History />}
        </div>
      </main>

      {/* 反馈模态框 */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </div>
  );
}
