import { useState } from 'react';
import { motion } from 'motion/react';
import { X, MessageCircle, Send, CheckCircle2, AlertCircle } from 'lucide-react';

type FeedbackType = 'issue' | 'suggestion' | 'other';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const feedbackTypes = [
  { id: 'issue' as FeedbackType, label: '问题反馈', icon: AlertCircle, color: 'red' },
  { id: 'suggestion' as FeedbackType, label: '功能建议', icon: MessageCircle, color: 'blue' },
  { id: 'other' as FeedbackType, label: '其他', icon: MessageCircle, color: 'gray' },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('issue');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setErrorMessage('请输入反馈内容');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          content: content.trim(),
          contact: contact.trim() || undefined,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '提交失败');
      }

      const result = await response.json();
      if (result.success) {
        setSubmitStatus('success');
        // 重置表单
        setContent('');
        setContact('');
        setType('issue');

        // 2秒后自动关闭
        setTimeout(() => {
          onClose();
          setSubmitStatus('idle');
        }, 2000);
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      setSubmitStatus('error');
      setErrorMessage((error as Error).message || '提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setContent('');
      setContact('');
      setType('issue');
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* 磨砂背景 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* 模态框 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* 头部 */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground font-medium">意见反馈</h3>
              <p className="text-xs text-muted-foreground">您的反馈是我们进步的动力</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg hover:bg-accent transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {submitStatus === 'success' ? (
            <div className="text-center py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </motion.div>
              <h3 className="text-lg font-medium text-foreground mb-2">感谢您的反馈！</h3>
              <p className="text-muted-foreground">我们会尽快处理您的反馈</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 反馈类型 */}
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">
                  反馈类型 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {feedbackTypes.map((ft) => {
                    const Icon = ft.icon;
                    const isSelected = type === ft.id;

                    return (
                      <button
                        key={ft.id}
                        type="button"
                        onClick={() => setType(ft.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            ft.color === 'red'
                              ? isSelected
                                ? 'text-red-600'
                                : 'text-red-400'
                              : ft.color === 'blue'
                              ? isSelected
                                ? 'text-blue-600'
                                : 'text-blue-400'
                              : isSelected
                              ? 'text-gray-600'
                              : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs text-foreground">{ft.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 反馈内容 */}
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">
                  反馈内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请详细描述您遇到的问题或建议..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {content.length}/500 字符
                </p>
              </div>

              {/* 联系方式（可选） */}
              <div>
                <label className="block mb-2 text-sm font-medium text-foreground">
                  联系方式 <span className="text-muted-foreground font-normal">(可选)</span>
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="邮箱、手机号或其他联系方式"
                  className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  如需我们回复，请留下联系方式
                </p>
              </div>

              {/* 错误提示 */}
              {errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}

              {/* 提交按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors text-foreground disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      <span>提交中...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>提交反馈</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 底部提示 */}
        {submitStatus !== 'success' && (
          <div className="border-t border-border px-6 py-3 bg-muted/30">
            <p className="text-xs text-center text-muted-foreground">
              💬 我们非常重视每一条反馈，会认真阅读和处理
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
