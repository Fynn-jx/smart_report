import { useState, useRef } from 'react';
import { Upload, Loader2, Download, CheckCircle2, X, Trash2, RefreshCw } from 'lucide-react';

// 单个文件的处理状态
type FileStatus = 'idle' | 'processing' | 'completed' | 'error';

// 单个文件的数据结构
interface FileData {
  file: File;
  previewUrl: string;
  resultUrl: string;
  status: FileStatus;
  error?: string;
  fileName: string;
  id: string;
}

export function ImageTranslation() {
  const [files, setFiles] = useState<FileData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 最多上传5张图片
  const MAX_FILES = 5;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = selectedFiles.filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      alert('请上传图片文件（JPG、PNG、GIF、WebP）');
      return;
    }

    // 如果有无效文件，提示用户
    if (validFiles.length < selectedFiles.length) {
      alert(`已跳过 ${selectedFiles.length - validFiles.length} 个无效文件`);
    }

    // 限制最多5张图片
    const filesToAdd = validFiles.slice(0, MAX_FILES - files.length);

    if (files.length + selectedFiles.length > MAX_FILES) {
      alert(`最多只能上传 ${MAX_FILES} 张图片，已自动选择前 ${filesToAdd.length} 张`);
    }

    // 创建新文件数据，包含预览
    const newFilesData: FileData[] = filesToAdd.map(file => {
      const previewUrl = URL.createObjectURL(file);
      return {
        file,
        previewUrl,
        resultUrl: '',
        status: 'idle' as FileStatus,
        fileName: file.name,
        id: `${file.name}_${Date.now()}_${Math.random()}`,
      };
    });

    setFiles([...files, ...newFilesData]);

    // 清空 input，允许重复选择同一批文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processSingleFile = async (fileData: FileData) => {
    const { file, fileName, id } = fileData;

    console.log(`开始处理文件: ${fileName} (ID: ${id})`);

    // 更新状态为处理中 - 使用 ID 匹配
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'processing' as FileStatus } : f
    ));

    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('发送请求到后端...');

      // 发送请求到本地Python后端服务器
      const response = await fetch('https://banksmart-report.onrender.com/api/translate-image', {
        method: 'POST',
        body: formData,
      });

      console.log('响应状态:', response.status, response.statusText);
      console.log('响应头:', Object.fromEntries(response.headers.entries()));

      // 检查响应状态
      if (!response.ok) {
        // 尝试解析错误信息
        let errorMsg = '处理失败';
        try {
          const errorData = await response.json();
          console.error('后端错误:', errorData);
          errorMsg = errorData.error || '处理失败';
        } catch {
          // 如果不是 JSON，使用状态文本
          errorMsg = `处理失败 (HTTP ${response.status})`;
        }
        throw new Error(errorMsg);
      }

      // 获取响应内容类型
      const contentType = response.headers.get('content-type') || '';

      console.log('Content-Type:', contentType);

      // 检查是否返回的是图片文件
      if (!contentType.startsWith('image/')) {
        const text = await response.text();
        console.error('非图片响应，实际内容:', text);
        throw new Error('服务器未返回图片');
      }

      console.log('开始读取 Blob...');

      // 将返回的图片转换为 Blob URL
      const blob = await response.blob();
      console.log('Blob 大小:', blob.size);
      console.log('Blob 类型:', blob.type);

      const url = URL.createObjectURL(blob);
      console.log('创建的 Blob URL:', url);

      // 更新为完成状态 - 使用 ID 匹配
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'completed' as FileStatus, resultUrl: url } : f
      ));

      console.log(`文件 ${fileName} 处理完成 (ID: ${id})`);

    } catch (error) {
      console.error('处理出错:', error);
      // 更新为错误状态 - 使用 ID 匹配
      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error' as FileStatus, error: (error as Error).message } : f
      ));
    }
  };

  const handleSubmit = async () => {
    const pendingFiles = files.filter(f => f.status === 'idle');
    if (pendingFiles.length === 0) return;

    // 依次处理每个文件（避免同时发送太多请求）
    for (const fileData of pendingFiles) {
      await processSingleFile(fileData);
    }
  };

  const handleRegenerate = async (fileData: FileData) => {
    const { id } = fileData;

    // 先清除之前的结果 - 使用 ID 匹配
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'idle' as FileStatus, resultUrl: '' } : f
    ));

    // 重新处理
    await processSingleFile(fileData);
  };

  const handleDownload = (fileData: FileData) => {
    if (!fileData.resultUrl) return;

    const a = document.createElement('a');
    a.href = fileData.resultUrl;
    a.download = `translated_${fileData.file.name}`;
    a.click();
  };

  const handleRemove = (fileData: FileData) => {
    const { id } = fileData;
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleReset = () => {
    files.forEach(f => {
      URL.revokeObjectURL(f.previewUrl);
      if (f.resultUrl) {
        URL.revokeObjectURL(f.resultUrl);
      }
    });
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <X className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case 'processing':
        return 'border-blue-300 bg-blue-50';
      case 'completed':
        return 'border-green-300 bg-green-50';
      case 'error':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-border bg-card';
    }
  };

  const getStatusText = (status: FileStatus) => {
    switch (status) {
      case 'processing':
        return '处理中...';
      case 'completed':
        return '已完成';
      case 'error':
        return '失败';
      default:
        return '等待';
    }
  };

  const completedCount = files.filter(f => f.status === 'completed').length;
  const hasPending = files.some(f => f.status === 'idle');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="mb-2">图片转译</h2>
        <p className="text-muted-foreground">
          上传最多 5 张图片，系统将自动识别并转译图片内容
        </p>
      </div>

      {/* 上传区域 - 没有文件时显示 */}
      {files.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            id="image-upload"
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="mb-2 text-foreground">点击上传图片</p>
            <p className="text-muted-foreground">
              支持 JPG、PNG、GIF、WebP 格式，最多 {MAX_FILES} 张
            </p>
          </label>
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <>
          {/* 添加更多文件按钮 */}
          {files.length < MAX_FILES && (
            <div className="mb-6">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                id="add-more-upload"
              />
              <label
                htmlFor="add-more-upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span>添加更多图片</span>
                <span className="text-muted-foreground">
                  ({files.length}/{MAX_FILES})
                </span>
              </label>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="mb-6 flex gap-3">
            {hasPending && (
              <button
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <span>开始转译</span>
                <Upload className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              清空全部
            </button>
          </div>

          {/* 左右分栏布局 */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 左侧：原图列表 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">原图</h3>
                <span className="text-sm text-muted-foreground">
                  {files.length} 张图片
                </span>
              </div>

              {files.map((fileData, index) => (
                <div
                  key={index}
                  className={`border-2 rounded-xl p-3 ${getStatusColor(fileData.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {/* 缩略图 */}
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted relative">
                      <img
                        src={fileData.previewUrl}
                        alt={fileData.file.name}
                        className="w-full h-full object-cover"
                      />
                      {fileData.status === 'processing' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm mb-1 truncate" title={fileData.file.name}>
                        {fileData.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {getStatusIcon(fileData.status)}
                        <span className="text-xs text-foreground">
                          {getStatusText(fileData.status)}
                        </span>
                      </div>
                      {fileData.status === 'error' && fileData.error && (
                        <div className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded mt-1">
                          {fileData.error}
                        </div>
                      )}
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleRemove(fileData)}
                      className="flex-shrink-0 p-1.5 hover:bg-destructive/10 rounded transition-colors"
                      title="删除此文件"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 右侧：转译结果列表 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">转译结果</h3>
                <span className="text-sm text-muted-foreground">
                  {completedCount} 张完成
                </span>
              </div>

              {files.map((fileData, index) => {
                // 只显示已完成的文件
                if (fileData.status !== 'completed') {
                  return null;
                }

                return (
                  <div
                    key={index}
                    className="border-2 border-green-300 bg-green-50 rounded-xl p-3"
                  >
                    <div className="flex items-start gap-3">
                      {/* 缩略图 */}
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
                        <img
                          src={fileData.resultUrl}
                          alt={fileData.file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* 文件信息和操作 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm mb-1 truncate" title={fileData.file.name}>
                          {fileData.file.name}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleDownload(fileData)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>下载</span>
                          </button>
                          <button
                            onClick={() => handleRegenerate(fileData)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border hover:bg-accent text-sm transition-colors"
                            title="重新转译此图片"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>重新生成</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 如果没有完成的文件，显示提示 */}
              {completedCount === 0 && (
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                  <p>暂无转译结果</p>
                  <p className="text-sm mt-1">
                    请上传图片并点击"开始转译"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 总结信息 */}
          <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border">
            <h3 className="font-medium mb-2">处理统计</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold text-foreground">{files.length}</div>
                <div className="text-muted-foreground">已选择</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {files.filter(f => f.status === 'idle').length}
                </div>
                <div className="text-muted-foreground">待处理</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                <div className="text-muted-foreground">已完成</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {files.filter(f => f.status === 'error').length}
                </div>
                <div className="text-muted-foreground">失败</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
