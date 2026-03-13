import { useState, useEffect } from 'react';
import { Clock, FileText, Globe, ImageIcon, Download, Loader2, CheckCircle2, X, AlertCircle, Eye, Trash2 } from 'lucide-react';
import { getApiConfig } from '@/config/api';

// 将markdown格式转换为纯文本（去除星号等标记）
const convertMarkdownToPlainText = (markdown: string): string => {
  let text = markdown;

  // 1. 移除加粗标记 **text** 或 __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');

  // 2. 移除斜体标记 *text* 或 _text_
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
  text = text.replace(/(?<!_)_([^_]+)_(?!_)/g, '$1');

  // 3. 移除删除线 ~~text~~
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // 4. 移除行内代码 `code`
  text = text.replace(/`([^`]+)`/g, '$1');

  // 5. 处理标题 # H1, ## H2, ### H3
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 6. 处理列表 - item 或 * item
  text = text.replace(/^[-*]\s+/gm, '• ');

  // 7. 处理数字列表 1. item
  text = text.replace(/^\d+\.\s+/gm, '');

  // 8. 移除链接 [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 9. 移除图片 ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

  // 10. 处理引用 > quote
  text = text.replace(/^>\s+/gm, '');

  // 11. 移除水平线 --- 或 *** 或 ___
  text = text.replace(/^[-*_]{3,}$/gm, '');

  // 12. 清理多余空格但保留段落
  text = text.replace(/^\s+$/gm, '');

  return text;
};

// 将内容转换为PDF并下载
const downloadAsPdf = (content: string, filename: string) => {
  // 先将markdown转换为纯文本
  const plainText = convertMarkdownToPlainText(content);

  // 将换行符转换为HTML换行
  const htmlContent = plainText.replace(/\n/g, '<br>');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('无法打开打印窗口，请检查浏览器设置');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body {
          font-family: "Microsoft YaHei", "SimSun", sans-serif;
          font-size: 12pt;
          line-height: 1.8;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 { font-size: 18pt; text-align: center; margin-bottom: 20px; }
        h2 { font-size: 14pt; margin-top: 24px; margin-bottom: 12px; }
        h3 { font-size: 13pt; margin-top: 18px; margin-bottom: 10px; }
        p { margin: 10px 0; text-align: justify; }
        ul, ol { margin: 10px 0; padding-left: 24px; }
        li { margin: 5px 0; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        blockquote { border-left: 3px solid #666; padding-left: 15px; margin-left: 0; color: #555; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
        pre { background: #f4f4f4; padding: 15px; overflow-x: auto; border-radius: 5px; }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>${htmlContent}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

type ConversionStatus = 'processing' | 'completed' | 'error';

interface ConversionRecord {
  id: string;
  task_type: string;
  input_file_name: string;
  status: ConversionStatus;
  output_url?: string;
  output_content?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  extra_params?: {
    style?: string;
    country?: string;
    report_type?: string;
  };
}

type FilterType = 'all' | 'academic_convert' | 'academic_translate' | 'country_situation' | 'country_quarterly' | 'image_translate';

const taskTypeLabels: Record<string, string> = {
  academic_convert: '学术报告转公文',
  academic_translate: '文档翻译',
  country_situation: '国别情况报告',
  country_quarterly: '季度研究报告',
  image_translate: '图片转译',
};

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  academic_convert: FileText,
  academic_translate: FileText,
  country_situation: Globe,
  country_quarterly: Globe,
  image_translate: ImageIcon,
};

export function History() {
  const [records, setRecords] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedRecord, setSelectedRecord] = useState<ConversionRecord | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const apiConfig = getApiConfig();

  const fetchRecords = async () => {
    setLoading(true);
    setError('');

    try {
      const url = new URL(`${apiConfig.BASE_URL}/api/conversions`);
      url.searchParams.set('user_id', 'default');
      url.searchParams.set('limit', '50');

      if (filter !== 'all') {
        url.searchParams.set('task_type', filter);
      }

      console.log('请求历史记录:', url.toString());

      const response = await fetch(url.toString());

      console.log('响应状态:', response.status);

      if (!response.ok) {
        throw new Error(`获取历史记录失败: ${response.status}`);
      }

      const data = await response.json();

      console.log('响应数据:', data);

      if (data.success) {
        setRecords(data.records || []);
      } else {
        throw new Error(data.error || '获取失败');
      }
    } catch (err) {
      console.error('获取历史记录失败:', err);
      setError(err instanceof Error ? err.message : '获取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [filter]);

  const handleDownload = (record: ConversionRecord) => {
    const content = record.output_url || record.output_content;
    if (!content) return;

    // 如果是 URL（PDF文件），直接打开
    if (record.output_url && record.output_url.startsWith('http')) {
      window.open(record.output_url, '_blank');
      return;
    }

    // 文本内容转换为PDF下载
    const taskLabel = taskTypeLabels[record.task_type] || 'result';
    const filename = `${taskLabel}_${record.id.substring(5, 19)}`;
    downloadAsPdf(content, filename);
  };

  // 预览处理函数
  const handlePreview = async (record: ConversionRecord) => {
    setSelectedRecord(record);
    setPreviewContent('');
    setIsLoadingPreview(true);

    try {
      // 如果有 output_url 且是 http URL，获取内容
      if (record.output_url && record.output_url.startsWith('http')) {
        // 对于 PDF 文件，直接打开新窗口
        window.open(record.output_url, '_blank');
        setIsLoadingPreview(false);
        return;
      }

      // 如果有 output_content，显示处理后的文本（去除星号等markdown标记）
      if (record.output_content) {
        const plainText = convertMarkdownToPlainText(record.output_content);
        setPreviewContent(plainText);
        setIsLoadingPreview(false);
        return;
      }

      // 否则显示占位信息
      setPreviewContent('该记录没有可预览的内容');
    } catch (err) {
      console.error('预览失败:', err);
      setPreviewContent('预览加载失败');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 关闭预览
  const closePreview = () => {
    setSelectedRecord(null);
    setPreviewContent('');
  };

  // 删除单条记录
  const handleDelete = async (recordId: string) => {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
      const url = new URL(`${apiConfig.BASE_URL}/api/conversions/${recordId}`);
      console.log('删除记录:', url.toString());

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });

      console.log('删除响应:', response.status, response.ok);

      if (response.ok) {
        // 删除成功后更新列表
        setRecords(records.filter(r => r.id !== recordId));
        alert('删除成功');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除失败');
      }
    } catch (err) {
      console.error('删除记录失败:', err);
      alert(`删除失败: ${err instanceof Error ? err.message : '请重试'}`);
    }
  };

  // 清空所有历史记录
  const handleClearAll = async () => {
    if (!confirm('确定要清空所有历史记录吗？此操作不可恢复！')) return;

    try {
      const url = new URL(`${apiConfig.BASE_URL}/api/conversions`);
      console.log('清空记录:', url.toString());

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });

      console.log('清空响应:', response.status, response.ok);

      if (response.ok) {
        setRecords([]);
        alert('清空成功');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '清空失败');
      }
    } catch (err) {
      console.error('清空历史记录失败:', err);
      alert(`清空失败: ${err instanceof Error ? err.message : '请重试'}`);
    }
  };

  const getStatusIcon = (status: ConversionStatus) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusText = (status: ConversionStatus) => {
    switch (status) {
      case 'processing':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'error':
        return '失败';
    }
  };

  const getStatusColor = (status: ConversionStatus) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredRecords = records;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="mb-2">历史记录</h2>
        <p className="text-muted-foreground">
          查看所有功能的使用历史和结果
        </p>
      </div>

      {/* 筛选器 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            filter === 'all'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border hover:border-primary/50'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => setFilter('academic_convert')}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            filter === 'academic_convert'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border hover:border-primary/50'
          }`}
        >
          学术转公文
        </button>
        <button
          onClick={() => setFilter('academic_translate')}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            filter === 'academic_translate'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border hover:border-primary/50'
          }`}
        >
          文档翻译
        </button>
        <button
          onClick={() => setFilter('country_situation')}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            filter === 'country_situation'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border hover:border-primary/50'
          }`}
        >
          国别情况报告
        </button>
        <button
          onClick={() => setFilter('country_quarterly')}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            filter === 'country_quarterly'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border hover:border-primary/50'
          }`}
        >
          季度研究报告
        </button>
        <button
          onClick={() => setFilter('image_translate')}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            filter === 'image_translate'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border hover:border-primary/50'
          }`}
        >
          图片转译
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="mb-4 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          共 {records.length} 条记录
        </span>
        <div className="flex gap-2">
          {records.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>清空全部</span>
            </button>
          )}
          <button
            onClick={fetchRecords}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-muted-foreground">正在加载历史记录...</p>
        </div>
      )}

      {/* 错误状态 */}
      {!loading && error && (
        <div className="bg-destructive/10 border border-destructive rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={fetchRecords}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            重试
          </button>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && filteredRecords.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">暂无历史记录</h3>
          <p className="text-muted-foreground">
            {filter === 'all' ? '还没有使用任何功能' : '该功能还没有使用记录'}
          </p>
        </div>
      )}

      {/* 记录列表 */}
      {!loading && !error && filteredRecords.length > 0 && (
        <div className="space-y-4">
          {filteredRecords.map((record) => {
            const Icon = taskTypeIcons[record.task_type] || FileText;

            return (
              <div
                key={record.id}
                className={`bg-card border-2 rounded-xl p-6 transition-all ${getStatusColor(record.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* 左侧信息 */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* 图标 */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-background flex items-center justify-center">
                      <Icon className="w-6 h-6 text-foreground" />
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-foreground">
                          {taskTypeLabels[record.task_type] || record.task_type}
                        </h3>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(record.status)}
                          <span className="text-sm text-muted-foreground">
                            {getStatusText(record.status)}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        文件: {record.input_file_name}
                      </p>

                      {/* 额外参数显示 */}
                      {record.extra_params && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {record.extra_params.style && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-background text-xs text-muted-foreground">
                              风格: {record.extra_params.style}
                            </span>
                          )}
                          {record.extra_params.country && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-background text-xs text-muted-foreground">
                              国家: {record.extra_params.country}
                            </span>
                          )}
                          {record.extra_params.report_type && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-background text-xs text-muted-foreground">
                              {record.extra_params.report_type === 'situation' ? '国别情况报告' : '季度研究报告'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 错误信息 */}
                      {record.status === 'error' && record.error_message && (
                        <p className="text-sm text-destructive mt-2">
                          错误: {record.error_message}
                        </p>
                      )}

                      {/* 时间信息 */}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(record.created_at)}
                        {record.completed_at && ` • 完成于 ${formatDate(record.completed_at)}`}
                      </p>
                    </div>
                  </div>

                  {/* 右侧操作 */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {/* 预览按钮 */}
                    {record.status === 'completed' && (record.output_url || record.output_content) && (
                      <button
                        onClick={() => handlePreview(record)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>预览</span>
                      </button>
                    )}
                    {/* 下载按钮 */}
                    {record.status === 'completed' && (record.output_url || record.output_content) && (
                      <button
                        onClick={() => handleDownload(record)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                        <span>下载</span>
                      </button>
                    )}
                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors"
                      title="删除记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 预览模态框 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="text-lg font-medium">
                  {taskTypeLabels[selectedRecord.task_type] || selectedRecord.task_type}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedRecord.input_file_name}
                </p>
              </div>
              <button
                onClick={closePreview}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 预览内容 */}
            <div className="flex-1 overflow-auto p-4">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : previewContent ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-muted p-4 rounded-lg overflow-auto max-h-[60vh]">
                  {previewContent}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-4" />
                  <p>内容为PDF文件，请点击下载按钮查看</p>
                </div>
              )}
            </div>

            {/* 模态框底部 */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={closePreview}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                关闭
              </button>
              {(selectedRecord.output_url || selectedRecord.output_content) && (
                <button
                  onClick={() => handleDownload(selectedRecord)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Download className="w-4 h-4" />
                  <span>下载</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {!loading && !error && records.length > 0 && (
        <div className="mt-8 p-6 rounded-xl bg-muted/30 border border-border">
          <h3 className="font-medium mb-4">统计信息</h3>
          <div className="grid grid-cols-4 gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold text-foreground">{records.length}</div>
              <div className="text-muted-foreground">总计</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {records.filter(r => r.status === 'completed').length}
              </div>
              <div className="text-muted-foreground">已完成</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {records.filter(r => r.status === 'processing').length}
              </div>
              <div className="text-muted-foreground">处理中</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {records.filter(r => r.status === 'error').length}
              </div>
              <div className="text-muted-foreground">失败</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
