import { motion } from 'motion/react';
import { X, Globe } from 'lucide-react';

interface Country {
  code: string;
  name: string;
  region: string;
}

interface CountrySelectionModalProps {
  isOpen: boolean;
  selectedCountry: string;
  onSelect: (countryCode: string) => void;
  onClose: () => void;
}

// 非洲国家列表，按A-Z排序
const countries: Country[] = [
  { code: 'algeria', name: '阿尔及利亚', region: 'Africa' },
  { code: 'angola', name: '安哥拉', region: 'Africa' },
  { code: 'benin', name: '贝宁', region: 'Africa' },
  { code: 'botswana', name: '博茨瓦纳', region: 'Africa' },
  { code: 'cameroon', name: '喀麦隆', region: 'Africa' },
  { code: 'chad', name: '乍得', region: 'Africa' },
  { code: 'congo', name: '刚果（布）', region: 'Africa' },
  { code: 'drc', name: '刚果（金）', region: 'Africa' },
  { code: 'egypt', name: '埃及', region: 'Africa' },
  { code: 'ethiopia', name: '埃塞俄比亚', region: 'Africa' },
  { code: 'gabon', name: '加蓬', region: 'Africa' },
  { code: 'ghana', name: '加纳', region: 'Africa' },
  { code: 'guinea', name: '几内亚', region: 'Africa' },
  { code: 'kenya', name: '肯尼亚', region: 'Africa' },
  { code: 'libya', name: '利比亚', region: 'Africa' },
  { code: 'madagascar', name: '马达加斯加', region: 'Africa' },
  { code: 'mali', name: '马里', region: 'Africa' },
  { code: 'morocco', name: '摩洛哥', region: 'Africa' },
  { code: 'mozambique', name: '莫桑比克', region: 'Africa' },
  { code: 'namibia', name: '纳米比亚', region: 'Africa' },
  { code: 'nigeria', name: '尼日利亚', region: 'Africa' },
  { code: 'rwanda', name: '卢旺达', region: 'Africa' },
  { code: 'senegal', name: '塞内加尔', region: 'Africa' },
  { code: 'south_africa', name: '南非', region: 'Africa' },
  { code: 'sudan', name: '苏丹', region: 'Africa' },
  { code: 'tanzania', name: '坦桑尼亚', region: 'Africa' },
  { code: 'tunisia', name: '突尼斯', region: 'Africa' },
  { code: 'uganda', name: '乌干达', region: 'Africa' },
  { code: 'zambia', name: '赞比亚', region: 'Africa' },
  { code: 'zimbabwe', name: '津巴布韦', region: 'Africa' },
];

export function CountrySelectionModal({
  isOpen,
  selectedCountry,
  onSelect,
  onClose,
}: CountrySelectionModalProps) {
  if (!isOpen) return null;

  const handleSelect = (countryCode: string) => {
    onSelect(countryCode);
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
              <h3 className="text-foreground">选择国家</h3>
              <p className="text-muted-foreground">请选择要生成报告的国家</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-accent transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 国家列表 */}
        <div className="overflow-y-auto p-6 max-h-[calc(80vh-5rem)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {countries.map((country, index) => (
              <motion.button
                key={country.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.02,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() => handleSelect(country.code)}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCountry === country.code
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <div
                  className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedCountry === country.code
                      ? 'border-primary'
                      : 'border-border'
                  }`}
                >
                  {selectedCountry === country.code && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="w-2.5 h-2.5 rounded-full bg-primary"
                    />
                  )}
                </div>
                <span className="text-foreground flex-1 min-w-0 truncate">
                  {country.name}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
