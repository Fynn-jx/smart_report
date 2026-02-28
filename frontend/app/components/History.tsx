import { useState, useEffect } from 'react';
import { Clock, FileText, Globe, ImageIcon, Download, Loader2, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { getApiConfig } from '@/config/api';

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

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error('获取历史记录失败');
      }

      const data = await response.json();

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

    let blob: Blob;
    let filename: string;

    if (record.output_url && record.output_url.startsWith('http')) {
      // 如果是 URL，打开新窗口
      window.open(record.output_url, '_blank');
      return;
    }

    // 文本内容下载
    blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const taskLabel = taskTypeLabels[record.task_type] || 'result';
    filename = `${taskLabel}_${record.id.substring(5, 19)}.txt`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

      {/* 刷新按钮 */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={fetchRecords}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <Clock className="w-4 h-4" />
          <span>刷新</span>
        </button>
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
                  {record.status === 'completed' && (record.output_url || record.output_content) && (
                    <button
                      onClick={() => handleDownload(record)}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <Download className="w-4 h-4" />
                      <span>下载</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
