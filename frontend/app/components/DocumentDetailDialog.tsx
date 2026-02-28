import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Tag, Folder, ExternalLink, Trash2, BookOpen, Languages, FileEdit } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  filename: string;
  source_url?: string;
  source_type: 'plugin' | 'manual' | 'upload';
  tags: string[];
  notes?: string;
  folder: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface DocumentDetailDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<Document>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  folders: string[];
  onProcessWithFunction: (doc: Document, type: 'academic_convert' | 'translate') => void;
}

export function DocumentDetailDialog({
  document,
  open,
  onClose,
  onSave,
  onDelete,
  folders,
  onProcessWithFunction
}: DocumentDetailDialogProps) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setTags(document.tags || []);
      setNotes(document.notes || '');
      setFolder(document.folder);
    }
  }, [document]);

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      await onSave(document.id, {
        title,
        tags,
        notes,
        folder
      });
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleDelete = async () => {
    if (!document) return;
    if (!confirm('确定要删除这篇文档吗？此操作不可恢复。')) return;

    try {
      await onDelete(document.id);
      onClose();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            文档详情
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{document.filename}</h3>
                <p className="text-sm text-muted-foreground">
                  {document.source_url && (
                    <a
                      href={document.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {document.source_url}
                    </a>
                  )}
                </p>
              </div>
            </div>

            <Separator />

            {/* 编辑表单 */}
            <div className="space-y-4">
              {/* 标题 */}
              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入文档标题"
                />
              </div>

              {/* 文件夹 */}
              <div className="space-y-2">
                <Label htmlFor="folder">文件夹</Label>
                <Select value={folder} onValueChange={setFolder}>
                  <SelectTrigger id="folder">
                    <SelectValue placeholder="选择文件夹" />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map(f => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 标签 */}
              <div className="space-y-2">
                <Label htmlFor="tags">标签</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="输入标签后按回车添加"
                  />
                  <Button type="button" variant="secondary" onClick={handleAddTag}>
                    添加
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 笔记 */}
              <div className="space-y-2">
                <Label htmlFor="notes">笔记</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="添加笔记或备注..."
                  rows={4}
                />
              </div>
            </div>

            <Separator />

            {/* 快速操作 */}
            <div className="space-y-2">
              <Label>快速操作</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    onProcessWithFunction(document, 'academic_convert');
                  }}
                >
                  <FileEdit className="w-4 h-4 mr-2" />
                  转换为公文
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    onProcessWithFunction(document, 'translate');
                  }}
                >
                  <Languages className="w-4 h-4 mr-2" />
                  翻译文档
                </Button>
              </div>
            </div>

            <Separator />

            {/* 元数据 */}
            <div className="space-y-2 text-sm">
              <Label>元数据</Label>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>文件类型: {document.file_type.toUpperCase()}</div>
                <div>来源: {document.source_type}</div>
                <div>创建时间: {new Date(document.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存更改'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
