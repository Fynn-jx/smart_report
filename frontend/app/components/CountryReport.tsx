import { useState } from 'react';
import { Globe, Loader2, Download, CheckCircle2, ChevronDown } from 'lucide-react';
import { CountrySelectionModal } from '@/components/CountrySelectionModal';
import { ReferenceFileUpload } from '@/components/ReferenceFileUpload';
import { getApiConfig } from '@/config/api';

type ReportType = 'situation' | 'quarterly';
type ProcessStatus = 'idle' | 'processing' | 'completed' | 'error';

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

// 国家名称映射
const countryNames: Record<string, string> = {
  egypt: '埃及',
  algeria: '阿尔及利亚',
  angola: '安哥拉',
  benin: '贝宁',
  botswana: '博茨瓦纳',
  cameroon: '喀麦隆',
  chad: '乍得',
  congo: '刚果（布）',
  drc: '刚果（金）',
  ethiopia: '埃塞俄比亚',
  gabon: '加蓬',
  ghana: '加纳',
  guinea: '几内亚',
  kenya: '肯尼亚',
  libya: '利比亚',
  madagascar: '马达加斯加',
  mali: '马里',
  morocco: '摩洛哥',
  mozambique: '莫桑比克',
  namibia: '纳米比亚',
  nigeria: '尼日利亚',
  rwanda: '卢旺达',
  senegal: '塞内加尔',
  south_africa: '南非',
  sudan: '苏丹',
  tanzania: '坦桑尼亚',
  tunisia: '突尼斯',
  uganda: '乌干达',
  zambia: '赞比亚',
  zimbabwe: '津巴布韦',
};

export function CountryReport() {
  const [country, setCountry] = useState('egypt');
  const [reportType, setReportType] = useState<ReportType>('situation');
  const [status, setStatus] = useState<ProcessStatus>('idle');
  const [result, setResult] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [referenceFileIds, setReferenceFileIds] = useState<string[]>([]);
  const apiConfig = getApiConfig();

  const handleGenerate = async () => {
    setStatus('processing');
    setResult('');

    try {
      const apiUrl = reportType === 'situation' 
        ? apiConfig.COUNTRY_REPORT_URL
        : apiConfig.QUARTERLY_REPORT_URL;
      
      const apiKey = reportType === 'situation'
        ? 'app-IWiuVAJEEBP8zoDUOME7XKKG'
        : 'app-IzeCySdSIPnMPXGakcgZU4Ry';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          country: country,
          user: 'default',
          reference_files: referenceFileIds, // 添加参考文件ID列表
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const data = await response.json();

      if (data.success) {
        setResult(data.report_content);
        setStatus('completed');
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (error) {
      setStatus('error');
      console.error('生成失败:', error);
      alert('生成失败：' + (error as Error).message);
    }
  };

  const handleDownload = () => {
    const filename = `${countryNames[country] || country}_${
      reportType === 'situation' ? '国别情况报告' : '季度报告'
    }`;
    downloadAsPdf(result, filename);
  };

  const handleReset = () => {
    setStatus('idle');
    setResult('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="mb-2">国别研究报告</h2>
        <p className="text-muted-foreground">
          选择国家和报告类型，系统将自动生成对应的研究报告
        </p>
      </div>

      {/* 配置区域 */}
      {(status === 'idle' || status === 'error') && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div>
            <label className="block mb-3 text-foreground">选择国家</label>
            <div className="grid gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 transition-all"
              >
                <Globe className="w-5 h-5 text-muted-foreground" />
                <span className="text-foreground flex-1 text-left">
                  {countryNames[country] || country}
                </span>
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-3 text-foreground">报告类型</label>
            <div className="grid gap-3">
              <button
                onClick={() => setReportType('situation')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  reportType === 'situation'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reportType === 'situation' ? 'border-primary' : 'border-border'
                  }`}
                >
                  {reportType === 'situation' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-foreground">国别情况报告</span>
              </button>

              <button
                onClick={() => setReportType('quarterly')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  reportType === 'quarterly'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reportType === 'quarterly' ? 'border-primary' : 'border-border'
                  }`}
                >
                  {reportType === 'quarterly' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-foreground">季度研究报告</span>
              </button>
            </div>
          </div>

          {/* 参考文件上传区域 */}
          <div className="pt-4 border-t border-border">
            <ReferenceFileUpload
              onFileIdsChange={setReferenceFileIds}
              disabled={status === 'processing'}
              maxFiles={1}
            />
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            生成报告
          </button>
        </div>
      )}

      {/* 处理中状态 */}
      {status === 'processing' && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <h3 className="mb-2">正在生成报告...</h3>
          <p className="text-muted-foreground">请稍候，系统正在处理您的请求</p>
        </div>
      )}

      {/* 完成状态 */}
      {status === 'completed' && result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800">报告生成完成！</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3>生成结果</h3>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                <span>下载</span>
              </button>
            </div>
            <div className="bg-muted rounded-lg p-6 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-foreground">{result}</pre>
            </div>
            <button
              onClick={handleReset}
              className="w-full mt-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              生成新报告
            </button>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {status === 'error' && (
        <div className="bg-card border border-destructive rounded-xl p-8 text-center">
          <p className="text-destructive mb-4">生成失败，请重试</p>
        </div>
      )}

      {/* 国家选择模态框 */}
      <CountrySelectionModal
        isOpen={isModalOpen}
        selectedCountry={country}
        onSelect={setCountry}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}