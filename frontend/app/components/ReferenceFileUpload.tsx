import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File, Loader2, CheckCircle2 } from 'lucide-react';

// 支持的文件类型
const SUPPORTED_TYPES = {
  'application/pdf': { extension: '.pdf', icon: FileText, label: 'PDF' },
  'application/msword': { extension: '.doc', icon: FileText, label: 'Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: '.docx', icon: FileText, label: 'Word' },
  'image/jpeg': { extension: '.jpg', icon: ImageIcon, label: 'JPG' },
  'image/png': { extension: '.png', icon: ImageIcon, label: 'PNG' },
  'image/gif': { extension: '.gif', icon: ImageIcon, label: 'GIF' },
  'image/webp': { extension: '.webp', icon: ImageIcon, label: 'WebP' },
  'text/plain': { extension: '.txt', icon: File, label: '文本' },
};

// 单个参考文件的数据结构
interface ReferenceFile {
  file: File;
  id: string;
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  fileId?: string; // Dify返回的文件ID
  error?: string;
}

interface ReferenceFileUploadProps {
  onFileIdsChange?: (fileIds: string[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export function ReferenceFileUpload({
  onFileIdsChange,
  disabled = false,
  maxFiles = 3,
}: ReferenceFileUploadProps) {
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取文件类型信息
  const getFileTypeInfo = (mimeType: string) => {
    return SUPPORTED_TYPES[mimeType] || { extension: '', icon: File, label: '文件' };
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // 验证文件类型
    const validFiles = selectedFiles.filter(file => {
      const isValid = Object.keys(SUPPORTED_TYPES).includes(file.type);
      if (!isValid) {
        alert(`不支持的文件类型: ${file.name}`);
      }
      return isValid;
    });

    // 检查数量限制
    const remainingSlots = maxFiles - files.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);

    if (validFiles.length > remainingSlots) {
      alert(`最多只能上传 ${maxFiles} 个参考文件，已自动选择前 ${remainingSlots} 个`);
    }

    if (filesToAdd.length === 0) return;

    // 创建新文件对象并开始上传
    const newFiles: ReferenceFile[] = filesToAdd.map(file => ({
      file,
      id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'uploading',
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // 自动上传每个文件
    for (const newFile of newFiles) {
      await uploadFile(newFile);
    }

    // 清空input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 上传文件到后端
  const uploadFile = async (refFile: ReferenceFile) => {
    try {
      const formData = new FormData();
      formData.append('file', refFile.file);
      formData.append('user', 'default');

      // 调用后端上传接口
      const response = await fetch('http://localhost:5000/api/dify/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上传失败');
      }

      const result = await response.json();

      // 更新文件状态为已上传
      setFiles(prev => prev.map(f =>
        f.id === refFile.id
          ? { ...f, status: 'uploaded', fileId: result.file_id }
          : f
      ));

      // 通知父组件更新文件ID列表
      updateFileIds();
    } catch (error) {
      console.error('上传参考文件失败:', error);
      setFiles(prev => prev.map(f =>
        f.id === refFile.id
          ? { ...f, status: 'error', error: (error as Error).message }
          : f
      ));
    }
  };

  // 更新文件ID列表
  const updateFileIds = () => {
    const uploadedFileIds = files
      .filter(f => f.status === 'uploaded' && f.fileId)
      .map(f => f.fileId!);
    onFileIdsChange?.(uploadedFileIds);
  };

  // 删除文件
  const handleRemove = (id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      // 更新文件ID列表
      const uploadedFileIds = newFiles
        .filter(f => f.status === 'uploaded' && f.fileId)
        .map(f => f.fileId!);
      onFileIdsChange?.(uploadedFileIds);
      return newFiles;
    });
  };

  // 获取状态图标
  const getStatusIcon = (status: ReferenceFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'uploaded':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'error':
        return <X className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const canAddMore = files.length < maxFiles;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          参考文件 <span className="text-muted-foreground font-normal">({files.length}/{maxFiles})</span>
        </label>
        {canAddMore && !disabled && (
          <label
            htmlFor={`ref-file-upload-${Date.now()}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer text-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>添加文件</span>
          </label>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      {canAddMore && !disabled && (
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt"
          className="hidden"
          id={`ref-file-upload-${Date.now()}`}
          disabled={disabled}
        />
      )}

      {/* 文件列表 */}
      {files.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">
            支持上传 1 个 PDF、Word、图片、文本文件作为参考素材
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((refFile) => {
            const typeInfo = getFileTypeInfo(refFile.file.type);
            const Icon = typeInfo.icon;

            return (
              <div
                key={refFile.id}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  refFile.status === 'error'
                    ? 'border-red-300 bg-red-50'
                    : refFile.status === 'uploaded'
                    ? 'border-green-300 bg-green-50'
                    : 'border-blue-300 bg-blue-50'
                }`}
              >
                {/* 文件类型图标 */}
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate" title={refFile.file.name}>
                    {refFile.file.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(refFile.file.size)}</span>
                    <span>•</span>
                    <span>{typeInfo.label}</span>
                  </div>
                  {refFile.status === 'error' && refFile.error && (
                    <p className="text-xs text-destructive mt-1">{refFile.error}</p>
                  )}
                </div>

                {/* 状态图标 */}
                <div className="flex-shrink-0">
                  {getStatusIcon(refFile.status)}
                </div>

                {/* 删除按钮 */}
                {!disabled && (
                  <button
                    onClick={() => handleRemove(refFile.id)}
                    className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
                    disabled={refFile.status === 'uploading'}
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 提示信息 */}
      {files.length > 0 && (
        <p className="text-xs text-muted-foreground">
          💡 参考文件将作为 conference_file 参数传递给工作流
        </p>
      )}
    </div>
  );
}
