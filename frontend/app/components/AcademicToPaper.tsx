import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, Download, CheckCircle2, X, Languages, FileEdit } from 'lucide-react';
import { StyleSelectionModal } from '@/components/Selection';
import { ReferenceFileUpload } from '@/components/ReferenceFileUpload';
import { getApiConfig } from '@/config/api';

type OperationType = 'translate' | 'rewrite';

interface AcademicToPaperProps {
  preselectedFileId?: string | null;
  preselectedOperation?: 'translate' | 'rewrite' | null;
  onFileProcessed?: () => void;
}

type ProcessingState = {
  id: string;
  type: OperationType;
  status: 'processing' | 'completed' | 'error';
  result?: string;
  isUrl?: boolean; // 是否是文件URL
};

// 判断是否为URL
const isUrl = (text: string): boolean => {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
};

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

  // 创建HTML内容用于打印
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
  // 等待内容加载后触发打印
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

export function AcademicToPaper({ preselectedFileId, preselectedOperation, onFileProcessed }: AcademicToPaperProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStates, setProcessingStates] = useState<ProcessingState[]>([]);
  const [fileId, setFileId] = useState<string | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('style1');
  const [referenceFileIds, setReferenceFileIds] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(null);
  const [preselectedLoading, setPreselectedLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiConfig = getApiConfig();

  // 自动加载预选文件
  useEffect(() => {
    if (preselectedFileId && !fileId) {
      loadPreselectedFile(preselectedFileId, preselectedOperation || undefined);
    }
  }, [preselectedFileId, preselectedOperation]);

  // 加载预选文件
  const loadPreselectedFile = async (docId: string, operation?: 'translate' | 'rewrite') => {
    setPreselectedLoading(true);
    try {
      // 获取文档信息
      const docResponse = await fetch(`${apiConfig.BASE_URL}/api/documents/${docId}`);
      if (!docResponse.ok) {
        throw new Error('获取文档信息失败');
      }
      const docData = await docResponse.json();

      // 获取文档下载URL
      const urlResponse = await fetch(`${apiConfig.BASE_URL}/api/documents/${docId}/url`);
      if (!urlResponse.ok) {
        throw new Error('获取文档URL失败');
      }
      const urlData = await urlResponse.json();

      if (urlData.url) {
        // 使用后端代理下载文件（解决跨域问题）
        const fileResponse = await fetch(`${apiConfig.BASE_URL}/api/documents/${docId}/download`);
        if (!fileResponse.ok) {
          throw new Error('下载文档失败');
        }
        const blob = await fileResponse.blob();

        // 创建 File 对象
        const fileName = docData.title || docData.filename || 'document.pdf';
        const fileType = blob.type || 'application/pdf';
        const preselectedFile = new File([blob], fileName, { type: fileType });

        setFile(preselectedFile);

        // 如果指定了操作类型，自动选择并上传
        if (operation) {
          setSelectedOperation(operation);
          // 延迟一点让 UI 更新，然后自动上传
          setTimeout(() => {
            handleUploadAndProcess(preselectedFile, operation);
          }, 100);
        }
      }
    } catch (err) {
      console.error('加载预选文件失败:', err);
      alert('加载文档失败，请手动上传');
    } finally {
      setPreselectedLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ];
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setIsUploading(false);
        setUploadProgress(0);
      } else {
        alert('请上传PDF或Word文件');
      }
    }
  };

  const handleOperation = async (type: OperationType) => {
    if (!file) return;

    if (type === 'rewrite') {
      setShowStyleModal(true);
      return;
    }

    const newState: ProcessingState = {
      id: Date.now().toString(),
      type,
      status: 'processing',
    };

    setProcessingStates((prev) => [...prev, newState]);

    try {
        let currentFileId = fileId;

        if (!fileId) {
          setIsUploading(true);
          setUploadProgress(0);

          const formData = new FormData();
          formData.append('file', file);
          formData.append('user', 'default');

          const uploadResponse = await fetch(apiConfig.UPLOAD_URL, {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || '上传失败');
          }

          const uploadResult = await uploadResponse.json();
          currentFileId = uploadResult.file_id;
          setFileId(currentFileId);

          setUploadProgress(100);
          await new Promise((resolve) => setTimeout(resolve, 500));
          setIsUploading(false);
        }

        const apiUrl =
          type === 'translate'
            ? apiConfig.TRANSLATE_URL
            : apiConfig.CONVERT_URL;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_id: currentFileId,
            user: 'default',
            output_format: 'docx',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '处理失败');
        }

        const result = await response.json();

        if (result.success) {
          const content =
            type === 'translate'
              ? result.translated_content
              : result.output_url;

          setProcessingStates((prev) =>
            prev.map((state) =>
              state.id === newState.id
                ? { ...state, status: 'completed', result: content }
                : state
            )
          );
        } else {
          throw new Error(result.error || '处理失败');
        }
    } catch (error) {
      setProcessingStates((prev) =>
        prev.map((state) =>
          state.id === newState.id ? { ...state, status: 'error' } : state
        )
      );
      console.error('处理失败:', error);
    }
  };

  // 处理预选文件（自动上传并处理）
  const handleUploadAndProcess = async (fileToProcess: File, type: OperationType) => {
    const newState: ProcessingState = {
      id: Date.now().toString(),
      type,
      status: 'processing',
    };

    setProcessingStates((prev) => [...prev, newState]);

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // 上传文件
      const formData = new FormData();
      formData.append('file', fileToProcess);
      formData.append('user', 'default');

      const uploadResponse = await fetch(apiConfig.UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || '上传失败');
      }

      const uploadResult = await uploadResponse.json();
      const currentFileId = uploadResult.file_id;
      setFileId(currentFileId);

      setUploadProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsUploading(false);

      // 调用处理 API
      const apiUrl = type === 'translate' ? apiConfig.TRANSLATE_URL : apiConfig.CONVERT_URL;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: currentFileId,
          user: 'default',
          output_format: 'docx',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '处理失败');
      }

      const result = await response.json();

      if (result.success) {
        const content = type === 'translate' ? result.translated_content : result.output_url;
        setProcessingStates((prev) =>
          prev.map((state) =>
            state.id === newState.id ? { ...state, status: 'completed', result: content } : state
          )
        );
      } else {
        throw new Error(result.error || '处理失败');
      }

      // 通知完成
      if (onFileProcessed) {
        onFileProcessed();
      }
    } catch (error) {
      setProcessingStates((prev) =>
        prev.map((state) =>
          state.id === newState.id ? { ...state, status: 'error' } : state
        )
      );
      console.error('处理失败:', error);
    }
  };

  const handleStyleSelect = async (style: string) => {
    setSelectedStyle(style);
    setShowStyleModal(false);

    const newState: ProcessingState = {
      id: Date.now().toString(),
      type: 'rewrite',
      status: 'processing',
    };

    setProcessingStates((prev) => [...prev, newState]);

    try {
        let currentFileId = fileId;

        if (!fileId) {
          setIsUploading(true);
          setUploadProgress(0);

          const formData = new FormData();
          formData.append('file', file);
          formData.append('user', 'default');

          const uploadResponse = await fetch(apiConfig.UPLOAD_URL, {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || '上传失败');
          }

          const uploadResult = await uploadResponse.json();
          currentFileId = uploadResult.file_id;
          setFileId(currentFileId);

          setUploadProgress(100);
          await new Promise((resolve) => setTimeout(resolve, 500));
          setIsUploading(false);
        }

        const response = await fetch(apiConfig.CONVERT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_id: currentFileId,
            user: 'default',
            output_format: 'docx',
            style: style,
            reference_files: referenceFileIds, // 添加参考文件ID列表
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '处理失败');
        }

        const result = await response.json();

        if (result.success) {
          const content = result.output_url;

          setProcessingStates((prev) =>
            prev.map((state) =>
              state.id === newState.id
                ? { ...state, status: 'completed', result: content }
                : state
            )
          );
        } else {
          throw new Error(result.error || '处理失败');
        }
    } catch (error) {
      setProcessingStates((prev) =>
        prev.map((state) =>
          state.id === newState.id ? { ...state, status: 'error' } : state
        )
      );
      console.error('处理失败:', error);
    }
  };

  const handleDownload = (result: string, type: OperationType) => {
    // 判断是否是URL（PDF文件链接）
    if (isUrl(result)) {
      // 直接下载PDF文件
      window.open(result, '_blank');
    } else {
      // 将markdown/text内容转换为PDF下载
      const filename = `${type === 'translate' ? '原文翻译' : '公文写作'}结果`;
      downloadAsPdf(result, filename);
    }
  };

  const handleRemoveResult = (id: string) => {
    setProcessingStates((prev) => prev.filter((state) => state.id !== id));
  };

  const handleReset = () => {
    setFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setProcessingStates([]);
    setFileId(null);
    setSelectedOperation(null);
    setReferenceFileIds([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 开始处理
  const handleStartProcessing = async () => {
    if (!selectedOperation) {
      alert('请先选择操作类型');
      return;
    }

    if (selectedOperation === 'translate') {
      await handleOperation('translate');
    } else if (selectedOperation === 'rewrite') {
      // 如果是公文写作，先显示风格选择
      setShowStyleModal(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="mb-2">学术报告处理</h2>
        <p className="text-muted-foreground">
          上传学术报告或研究报告，可选择原文翻译或公文写作
        </p>
      </div>

      {/* 预选文件加载提示 */}
      {preselectedLoading && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-8 text-center mb-6">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-primary">正在加载文档...</p>
        </div>
      )}

      {/* 上传区域 */}
      {!file && (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx"
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="mb-2 text-foreground">点击上传文件</p>
            <p className="text-muted-foreground">支持 PDF、Word 格式</p>
          </label>
        </div>
      )}

      {/* 已选择文件 - 显示文件信息和操作按钮 */}
      {file && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground mb-1 truncate">{file.name}</p>
                <p className="text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 上传进度 */}
            {isUploading && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <p className="text-muted-foreground">正在上传文件...</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1">{uploadProgress}%</p>
              </div>
            )}

            {/* 操作选择 */}
            {!isUploading && (
              <div className="space-y-6">
                <label className="block mb-3 text-foreground">选择操作类型</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedOperation('translate')}
                    disabled={isUploading}
                    className={`flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedOperation === 'translate'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Languages className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground mb-1">原文翻译</p>
                      <p className="text-sm text-muted-foreground">
                        将文档翻译为英文
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('rewrite')}
                    disabled={isUploading}
                    className={`flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedOperation === 'rewrite'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <FileEdit className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground mb-1">公文写作</p>
                      <p className="text-sm text-muted-foreground">
                        转换为规范公文格式
                      </p>
                    </div>
                  </button>
                </div>

                {/* 参考文件上传区域 - 只在选择"公文写作"时显示 */}
                {selectedOperation === 'rewrite' && (
                  <div className="pt-4 border-t border-border">
                    <ReferenceFileUpload
                      onFileIdsChange={setReferenceFileIds}
                      disabled={isUploading}
                      maxFiles={1}
                    />
                  </div>
                )}

                {/* 开始处理按钮 - 选择操作后才显示 */}
                {selectedOperation && (
                  <button
                    onClick={handleStartProcessing}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="font-medium">
                      {selectedOperation === 'translate' ? '开始翻译' : '开始写作'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 处理结果列表 */}
          {processingStates.map((state) => (
            <div key={state.id} className="bg-card border border-border rounded-xl p-6">
              {/* 处理中状态 */}
              {state.status === 'processing' && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                  <h3 className="mb-2">
                    {state.type === 'translate' ? '正在翻译...' : '正在写作...'}
                  </h3>
                  <p className="text-muted-foreground">
                    预计需要 8-10 分钟，请耐心等待
                  </p>
                </div>
              )}

              {/* 完成状态 */}
              {state.status === 'completed' && state.result && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          state.type === 'translate'
                            ? 'bg-blue-500/10'
                            : 'bg-green-500/10'
                        }`}
                      >
                        {state.type === 'translate' ? (
                          <Languages className="w-5 h-5 text-blue-600" />
                        ) : (
                          <FileEdit className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h3>
                          {state.type === 'translate' ? '原文翻译结果' : '公文写作结果'}
                        </h3>
                        <p className="text-sm text-muted-foreground">处理完成</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(state.result!, state.type)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                        <span>下载</span>
                      </button>
                      <button
                        onClick={() => handleRemoveResult(state.id)}
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-6 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans text-foreground">
                      {state.result}
                    </pre>
                  </div>
                </div>
              )}

              {/* 错误状态 */}
              {state.status === 'error' && (
                <div className="text-center py-8">
                  <p className="text-destructive mb-4">处理失败，请重试</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleOperation(state.type)}
                      className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      重试
                    </button>
                    <button
                      onClick={() => handleRemoveResult(state.id)}
                      className="px-6 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      移除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <StyleSelectionModal
        isOpen={showStyleModal}
        onSelect={handleStyleSelect}
        onClose={() => setShowStyleModal(false)}
      />
    </div>
  );
}