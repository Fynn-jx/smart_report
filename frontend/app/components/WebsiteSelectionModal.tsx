import { motion } from 'motion/react';
import { X, Globe, Building2, FileText, TrendingUp, Scale, BarChart3 } from 'lucide-react';

interface Website {
  id: string;
  name: string;
  count: number;
  icon?: string;
}

interface WebsiteSelectionModalProps {
  isOpen: boolean;
  websites: Website[];
  selectedWebsite: string;
  onSelect: (websiteId: string) => void;
  onClose: () => void;
}

// 网站数据
const websiteData: Website[] = [
  { id: 'worldbank.org', name: '世界银行', count: 0, icon: 'bank' },
  { id: 'imf.org', name: 'IMF国际货币基金组织', count: 0, icon: 'bank' },
  { id: 'un.org', name: '联合国', count: 0, icon: 'un' },
  { id: 'unea', name: '联合国非洲经济委员会', count: 0, icon: 'un' },
  { id: 'uneca', name: '联合国非洲经济委员会', count: 0, icon: 'un' },
  { id: 'afdb.org', name: '非洲开发银行', count: 0, icon: 'bank' },
  { id: 'wto.org', name: 'WTO世贸组织', count: 0, icon: 'trade' },
  { id: 'oecd.org', name: 'OECD经合组织', count: 0, icon: 'org' },
  { id: 'nielsen.com', name: 'Nielsen尼尔森', count: 0, icon: 'research' },
  { id: 'mckinsey.com', name: '麦肯锡', count: 0, icon: 'consulting' },
  { id: 'bcg.com', name: '波士顿咨询', count: 0, icon: 'consulting' },
  { id: 'bain.com', name: '贝恩咨询', count: 0, icon: 'consulting' },
  { id: 'centralbank.gov.cn', name: '中国人民银行', count: 0, icon: 'bank' },
  { id: 'stats.gov.cn', name: '国家统计局', count: 0, icon: 'stats' },
];

// 合并实际数量
const getWebsitesWithCount = (websites: {id: string, name: string, count: number}[]): Website[] => {
  return websiteData.map(w => {
    const found = websites.find(s => s.id === w.id);
    return { ...w, count: found?.count || 0 };
  });
};

// 获取网站图标
const getWebsiteIcon = (icon?: string) => {
  switch (icon) {
    case 'bank':
      return <Building2 className="w-5 h-5" />;
    case 'un':
      return <Globe className="w-5 h-5" />;
    case 'trade':
      return <TrendingUp className="w-5 h-5" />;
    case 'org':
      return <Scale className="w-5 h-5" />;
    case 'research':
    case 'consulting':
      return <FileText className="w-5 h-5" />;
    case 'stats':
      return <BarChart3 className="w-5 h-5" />;
    default:
      return <Globe className="w-5 h-5" />;
  }
};

export function WebsiteSelectionModal({
  isOpen,
  websites,
  selectedWebsite,
  onSelect,
  onClose,
}: WebsiteSelectionModalProps) {
  if (!isOpen) return null;

  const allWebsites = getWebsitesWithCount(websites);

  const handleSelect = (websiteId: string) => {
    onSelect(websiteId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* 磨砂背景 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* 模态框 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl max-h-[80vh] bg-card rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground">选择来源网站</h3>
              <p className="text-muted-foreground">筛选来自特定机构的文档</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-accent transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 网站列表 */}
        <div className="overflow-y-auto p-6 max-h-[calc(80vh-5rem)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allWebsites.map((website, index) => (
              <motion.button
                key={website.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.02,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() => handleSelect(website.id)}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  selectedWebsite === website.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedWebsite === website.id
                    ? 'border-primary'
                    : 'border-border'
                }`}>
                  {selectedWebsite === website.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="w-2.5 h-2.5 rounded-full bg-primary"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground flex-1 min-w-0 truncate">
                      {website.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {website.count} 个文档
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
