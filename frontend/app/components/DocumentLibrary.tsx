import { useState, useEffect, useMemo } from 'react';
import {
  FileText, FileEdit, Folder, Plus, Search, Tag, Trash2, Edit3,
  Download, Star, MoreVertical, FolderPlus, BookOpen,
  ExternalLink, Upload, Languages, X, Move, FileDown, Globe
} from 'lucide-react';
import { getApiConfig } from '@/config/api';
import { DocumentDetailDialog } from './DocumentDetailDialog';

// 从URL中提取网站名称
const extractWebsiteName = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');

    // 常见网站映射
    const websiteMap: Record<string, string> = {
      'worldbank.org': '世界银行',
      'wb': '世界银行',
      'imf.org': 'IMF国际货币基金组织',
      'un.org': '联合国',
      'unea': '联合国非洲经济委员会',
      'uneca': '联合国非洲经济委员会',
      'afdb.org': '非洲开发银行',
      'africandevelopmentbank': '非洲开发银行',
      'wto.org': 'WTO世贸组织',
      'oecd.org': 'OECD经合组织',
      'asia.nielsen.com': 'Nielsen尼尔森',
      'nielsen.com': 'Nielsen尼尔森',
      'mckinsey.com': 'McKinsey麦肯锡',
      'bcg.com': 'BCG波士顿咨询',
      'bain.com': 'Bain贝恩',
      'forrester.com': 'Forrester',
      'gartner.com': 'Gartner',
      'centralbank.gov.cn': '中国人民银行',
      'pbc.gov.cn': '中国人民银行',
      'stats.gov.cn': '国家统计局',
      'gov.cn': '中国政府网',
      'cn': '中国',
    };

    // 检查是否匹配已知网站
    for (const [key, name] of Object.entries(websiteMap)) {
      if (hostname.includes(key)) {
        return name;
      }
    }

    // 返回主机名（去掉.com/.org等后缀前的部分）
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    }
    return hostname;
  } catch {
    return '';
  }
};
import { FolderManagerDialog } from './FolderManagerDialog';
import { PDFPreview } from './PDFPreview';
import { WebsiteSelectionModal } from './WebsiteSelectionModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

interface DocumentTag {
  label: string;
  color?: string;
}

interface Document {
  id: string;
  title: string;
  filename: string;
  source_url?: string;
  source_type: 'plugin' | 'manual' | 'upload';
  tags: (string | DocumentTag)[];
  notes?: string;
  folder: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface Folder {
  id: string;
  name: string;
  color: string;
  count: number;
}

// Helper function to get tag label string
function getTagLabel(tag: string | DocumentTag): string {
  if (typeof tag === 'object' && tag !== null && 'label' in tag) {
    return tag.label;
  }
  return String(tag);
}

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [websites, setWebsites] = useState<{id: string, name: string, count: number}[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const apiConfig = getApiConfig();

  // Dialogs state
  const [detailDoc, setDetailDoc] = useState<Document | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false);
  const [batchMoveTarget, setBatchMoveTarget] = useState<string>('');
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 清理 blob URL 避免内存泄漏
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      let url = new URL(`${apiConfig.BASE_URL}/api/documents`);
      url.searchParams.set('user_id', 'default');

      if (selectedFolder && selectedFolder !== '全部') {
        url.searchParams.set('folder', selectedFolder);
      }

      if (selectedWebsite) {
        url.searchParams.set('website', selectedWebsite);
      }

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('获取文档失败');
      const data = await response.json();

      if (data.success) {
        // Normalize tags to strings
        const normalizedDocs = (data.documents || []).map((doc: any) => ({
          ...doc,
          tags: (doc.tags || []).map((tag: any) =>
            typeof tag === 'object' && tag !== null ? String(tag.label || '') : String(tag)
          )
        }));
        setDocuments(normalizedDocs);
      } else {
        throw new Error(data.error || '获取失败');
      }
    } catch (error) {
      console.error('获取文档失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch(`${apiConfig.BASE_URL}/api/folders?user_id=default`);
      if (!response.ok) throw new Error('获取文件夹失败');
      const data = await response.json();

      if (data.success) {
        setFolders(data.folders || []);
      } else {
        throw new Error(data.error || '获取失败');
      }
    } catch (error) {
      console.error('获取文件夹失败:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${apiConfig.BASE_URL}/api/stats?user_id=default`);
      if (!response.ok) throw new Error('获取统计失败');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  const fetchWebsites = async () => {
    try {
      const response = await fetch(`${apiConfig.BASE_URL}/api/websites?user_id=default`);
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites || []);
      }
    } catch (error) {
      console.error('获取网站列表失败:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchFolders();
    fetchStats();
  }, [selectedFolder]);

  // 网站筛选变化时重新获取文档
  useEffect(() => {
    fetchDocuments();
  }, [selectedWebsite]);

  // 初始加载时获取网站列表
  useEffect(() => {
    fetchWebsites();
  }, []);

  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // 文件夹筛选
    if (selectedFolder && selectedFolder !== '全部') {
      filtered = filtered.filter(d => d.folder === selectedFolder);
    }

    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.filename.toLowerCase().includes(query) ||
        d.tags?.some(tag => getTagLabel(tag).toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [documents, selectedFolder, searchQuery]);

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.target.checked) {
        setSelectedDocs(prev => {
          const newSet = new Set(prev);
          newSet.add(docId);
          return newSet;
        });
      } else {
        setSelectedDocs(prev => {
          const newSet = new Set(prev);
          newSet.delete(docId);
          return newSet;
        });
      }
    } else {
      setSelectedDocs(new Set(docId));
    }
  };

  const handleSelectAll = () => {
    if (selectedDocs.size === filteredDocuments.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const response = await fetch(`${apiConfig.BASE_URL}/api/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除失败');
      const data = await response.json();

      if (data.success) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试');
    }
  };

  const handleUpdateDocument = async (id: string, data: Partial<Document>) => {
    try {
      const response = await fetch(`${apiConfig.BASE_URL}/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('更新失败');
      const result = await response.json();

      if (result.success) {
        setDocuments(prev =>
          prev.map(d => d.id === id ? { ...d, ...result.document } : d)
        );
      } else {
        throw new Error(result.error || '更新失败');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleOpenDocument = async (doc: Document) => {
    setPreviewLoading(true);
    setShowPreview(true);
    setPreviewDoc(doc);

    // 清理之前的 blob URL
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    try {
      // 使用后端代理下载文档（解决跨域问题）
      const response = await fetch(`${apiConfig.BASE_URL}/api/documents/${doc.id}/download`);

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      // 创建 Blob URL 用于预览
      const blobUrl = URL.createObjectURL(blob);
      setPreviewUrl(blobUrl);
    } catch (error) {
      console.error('获取预览失败:', error);
      alert('获取预览失败');
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleProcessWithFunction = (doc: Document, functionType: 'academic_convert' | 'translate') => {
    // 跳转到对应功能页，传递文档ID
    const url = functionType === 'academic_convert'
      ? `/?doc_id=${doc.id}&mode=academic`
      : `/?doc_id=${doc.id}&mode=translate`;
    window.location.href = url;
  };

  const handleCreateFolder = async (name: string, color: string) => {
    try {
      const response = await fetch(`${apiConfig.BASE_URL}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color,
          user_id: 'default'
        }),
      });

      if (!response.ok) throw new Error('创建失败');
      const data = await response.json();

      if (data.success) {
        await fetchFolders();
        return data.success;
      }
      throw new Error(data.error || '创建失败');
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      // 将该文件夹的文档移到"未分类"
      const docsInFolder = documents.filter(d => d.folder === folder.name);
      for (const doc of docsInFolder) {
        await handleUpdateDocument(doc.id, { folder: '未分类' });
      }

      alert(`已将 ${docsInFolder.length} 个文档移至"未分类"`);
      await fetchFolders();
    } catch (error) {
      console.error('删除文件夹失败:', error);
      throw error;
    }
  };

  const handleBatchDelete = async () => {
    try {
      for (const docId of selectedDocs) {
        await handleDeleteDocument(docId);
      }
      setSelectedDocs(new Set());
      setShowBatchDeleteDialog(false);
      fetchStats();
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败，请重试');
    }
  };

  const handleBatchMove = async () => {
    try {
      for (const docId of selectedDocs) {
        await handleUpdateDocument(docId, { folder: batchMoveTarget });
      }
      setSelectedDocs(new Set());
      setShowBatchMoveDialog(false);
      fetchDocuments();
      fetchStats();
    } catch (error) {
      console.error('批量移动失败:', error);
      alert('批量移动失败，请重试');
    }
  };

  const getFolderColor = (folder: string) => {
    const colors: Record<string, string> = {
      '全部': '#6B7280',
      '金融经济': '#059669',
      '国际贸易': '#2563EB',
      '国际关系': '#DC2626',
      '法律政策': '#7C3AED',
      '统计资料': '#0891B2',
      '其他': '#6B7280',
    };
    return colors[folder] || '#6B7280';
  };

  const getFolderIcon = (folder: string) => {
    if (folder === '全部') return <Folder className="w-5 h-5" />;
    return <Folder className="w-5 h-5" style={{ color: getFolderColor(folder) }} />;
  };

  const getFileIcon = (type: string) => {
    if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (type === 'doc' || type === 'docx') return <FileText className="w-5 h-5 text-blue-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const getSourceBadge = (sourceType: string) => {
    const badges = {
      'plugin': { label: '网页', color: 'bg-blue-500/10 text-blue-600' },
      'manual': { label: '上传', color: 'bg-green-500/10 text-green-600' },
      'upload': { label: '生成', color: 'bg-purple-500/10 text-purple-600' },
    };
    return badges[sourceType] || { label: '未知', color: 'bg-gray-500/10 text-gray-600' };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const availableFolders = folders.filter(f => f.name !== '全部');

  return (
    <div className="max-w-7xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">我的文献库</h1>
          <p className="text-muted-foreground">管理所有收集的文档和资料</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFolderDialog(true)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>管理文件夹</span>
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            返回功能页
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">文档总数</h3>
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-4xl font-bold text-foreground">{stats.total || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">所有文档</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">网页保存</h3>
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-4xl font-bold text-blue-500">{stats.by_source?.plugin || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">来自浏览器插件</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">手动上传</h3>
              <Upload className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-4xl font-bold text-green-500">{stats.by_source?.upload || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">从转换功能生成</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground">最近添加</h3>
              <Plus className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-4xl font-bold text-purple-500">{stats.recent_count || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">最近7天</p>
          </div>
        </div>
      )}

      {/* 快捷链接 */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground mb-4">国际经济组织</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="https://www.un.org/zh/aboutun/structure/uneca/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-center"
          >
            <span className="text-2xl">🇺🇳</span>
            <span className="text-sm font-medium text-blue-700">联合国非洲经济委员会</span>
            <span className="text-xs text-blue-600">UNECA</span>
          </a>
          <a
            href="https://afdb-org.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-center"
          >
            <span className="text-2xl">🏛️</span>
            <span className="text-sm font-medium text-green-700">非洲开发银行</span>
            <span className="text-xs text-green-600">AFDB</span>
          </a>
          <a
            href="https://www.shihang.org/ext/zh/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-center"
          >
            <span className="text-2xl">🏦</span>
            <span className="text-sm font-medium text-red-700">世界银行</span>
            <span className="text-xs text-red-600">World Bank</span>
          </a>
          <a
            href="https://www.imf.org/zh/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-center"
          >
            <span className="text-2xl">💰</span>
            <span className="text-sm font-medium text-purple-700">国际货币基金组织</span>
            <span className="text-xs text-purple-600">IMF</span>
          </a>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center gap-4 mb-6">
        {/* 搜索框 */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 新建文档按钮 */}
        <button
          onClick={() => alert('功能开发中...')}
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>新建</span>
        </button>
      </div>

      {/* 文件夹筛选 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 border-b border-border">
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => setSelectedFolder(folder.name)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors whitespace-nowrap ${
              selectedFolder === folder.name
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {getFolderIcon(folder.name)}
            <span className="font-medium">{folder.name}</span>
            <span className="text-sm text-muted-foreground">({folder.count})</span>
          </button>
        ))}
      </div>

      {/* 来源网站筛选按钮 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowWebsiteModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
            selectedWebsite
              ? 'border-blue-500 bg-blue-500/10 text-blue-600'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
          }`}
        >
          <Globe className="w-5 h-5" />
          <span className="font-medium">
            {selectedWebsite
              ? websites.find(w => w.id === selectedWebsite)?.name || '已选择来源'
              : '筛选来源网站'}
          </span>
          {selectedWebsite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedWebsite('');
              }}
              className="ml-1 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </button>
        {selectedWebsite && (
          <span className="text-sm text-muted-foreground">
            已筛选: {websites.find(w => w.id === selectedWebsite)?.count || 0} 个文档
          </span>
        )}
      </div>

      {/* 网站选择模态框 */}
      <WebsiteSelectionModal
        isOpen={showWebsiteModal}
        websites={websites}
        selectedWebsite={selectedWebsite}
        onSelect={setSelectedWebsite}
        onClose={() => setShowWebsiteModal(false)}
      />

      {/* 批量操作栏 */}
      {selectedDocs.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-foreground">已选择 {selectedDocs.size} 项</span>
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
          >
            {selectedDocs.size === filteredDocuments.length ? '取消全选' : '全选'}
          </button>
          <button
            onClick={() => setShowBatchMoveDialog(true)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm flex items-center gap-1"
          >
            <Move className="w-3 h-3" />
            移动到...
          </button>
          <button
            onClick={() => setShowBatchDeleteDialog(true)}
            className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            批量删除
          </button>
        </div>
      )}

      {/* 文档列表 */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-muted-foreground">加载文档列表...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground mb-2">暂无文档</h3>
          <p className="text-muted-foreground mb-6">
            {selectedFolder === '全部'
              ? '还没有添加任何文档'
              : `"${selectedFolder}"文件夹中还没有文档`}
          </p>
          <p className="text-sm text-muted-foreground">
            💡 提示：使用浏览器插件保存网页PDF，或直接上传本地文件
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className={`bg-card border-2 rounded-xl p-4 transition-all ${
                selectedDocs.has(doc.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDocs.has(doc.id)}
                  onChange={(e) => handleDocSelect(e, doc.id)}
                  className="w-5 h-5 rounded border-2 border-border bg-background"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {getFileIcon(doc.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground line-clamp-1">
                          {doc.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const badge = getSourceBadge(doc.source_type);
                            return <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>{badge.label}</span>;
                          })()}
                          {doc.source_url && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              {extractWebsiteName(doc.source_url)}
                            </span>
                          )}
                          <span className="text-sm text-muted-foreground">{doc.filename}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)} · {(doc.file_type || 'unknown').toUpperCase()}
                      </p>
                      {doc.source_url && (
                        <div className="flex items-center gap-1 mt-1">
                          <ExternalLink className="w-3 h-3 text-blue-500" />
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline truncate max-w-[250px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {doc.source_url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.preventDefault(); handleOpenDocument(doc); }}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="打开文档"
                  >
                    <BookOpen className="w-4 h-4 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); handleProcessWithFunction(doc, 'academic_convert'); }}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="转公文"
                  >
                    <FileEdit className="w-4 h-4 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); handleProcessWithFunction(doc, 'translate'); }}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="翻译"
                  >
                    <Languages className="w-4 h-4 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDetailDoc(doc);
                      setShowDetailDialog(true);
                    }}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="编辑详情"
                  >
                    <Edit3 className="w-4 h-4 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); handleDeleteDocument(doc.id); }}
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </label>

              {doc.tags && doc.tags.length > 0 && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border ml-8">
                  {doc.tags.map((tag, index) => {
                    const tagStr = typeof tag === 'object' ? JSON.stringify(tag) : String(tag);
                    return (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                    >
                      <Tag className="w-3 h-3" />
                      <span>{tagStr}</span>
                    </span>
                  )})}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 文档详情对话框 */}
      <DocumentDetailDialog
        document={detailDoc}
        open={showDetailDialog}
        onClose={() => {
          setShowDetailDialog(false);
          setDetailDoc(null);
        }}
        onSave={handleUpdateDocument}
        onDelete={handleDeleteDocument}
        folders={availableFolders.map(f => f.name)}
        onProcessWithFunction={handleProcessWithFunction}
      />

      {/* 文档预览对话框 */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title || '文档预览'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : previewUrl ? (
              <PDFPreview url={previewUrl} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">无法预览此文档</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件夹管理对话框 */}
      <FolderManagerDialog
        open={showFolderDialog}
        onClose={() => setShowFolderDialog(false)}
        folders={availableFolders}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* 批量删除确认对话框 */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedDocs.size} 个文档吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量移动对话框 */}
      <AlertDialog open={showBatchMoveDialog} onOpenChange={setShowBatchMoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量移动文档</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>将选中的 {selectedDocs.size} 个文档移动到：</p>
              <select
                value={batchMoveTarget}
                onChange={(e) => setBatchMoveTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              >
                <option value="">选择目标文件夹</option>
                {availableFolders.map(f => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchMove}
              disabled={!batchMoveTarget}
            >
              确认移动
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
