import { motion } from 'motion/react';
import { X, FileEdit, CheckCircle } from 'lucide-react';

interface StyleSelectionModalProps {
  isOpen: boolean;
  onSelect: (style: string) => void;
  onClose: () => void;
}

const styles = [
  {
    id: 'style1',
    name: '风格1',
    color: 'blue',
  },
  {
    id: 'style2',
    name: '风格2',
    color: 'green',
  },
  {
    id: 'style3',
    name: '风格3',
    color: 'purple',
  },
];

export function StyleSelectionModal({ isOpen, onSelect, onClose }: StyleSelectionModalProps) {
  if (!isOpen) return null;

  const handleSelect = (styleId: string) => {
    onSelect(styleId);
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
        className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* 头部 */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileEdit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground">选择公文风格</h3>
              <p className="text-sm text-muted-foreground">请选择您需要的写作风格</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-accent transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 风格选项 */}
        <div className="p-6 space-y-3">
          {styles.map((style, index) => (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => handleSelect(style.id)}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
            >
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                  style.color === 'blue'
                    ? 'bg-blue-500/10 group-hover:bg-blue-500/20'
                    : style.color === 'green'
                    ? 'bg-green-500/10 group-hover:bg-green-500/20'
                    : 'bg-purple-500/10 group-hover:bg-purple-500/20'
                }`}
              >
                <CheckCircle
                  className={`w-6 h-6 ${
                    style.color === 'blue'
                      ? 'text-blue-600'
                      : style.color === 'green'
                      ? 'text-green-600'
                      : 'text-purple-600'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground mb-1">{style.name}</h4>
              </div>
            </motion.button>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="border-t border-border px-6 py-4 bg-muted/30">
          <p className="text-sm text-muted-foreground text-center">
            选择风格后将开始处理，预计需要 8-10 分钟
          </p>
        </div>
      </motion.div>
    </div>
  );
}
