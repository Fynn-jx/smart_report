import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Folder, FolderPlus, Trash2, Edit3, Check, X } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface FolderManagerDialogProps {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  onCreateFolder: (name: string, color: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
];

export function FolderManagerDialog({
  open,
  onClose,
  folders,
  onCreateFolder,
  onDeleteFolder
}: FolderManagerDialogProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 重置表单
  useEffect(() => {
    if (open) {
      setNewFolderName('');
      setSelectedColor('#3B82F6');
    }
  }, [open]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('请输入文件夹名称');
      return;
    }

    // 检查重名
    if (folders.some(f => f.name === newFolderName.trim())) {
      alert('文件夹名称已存在');
      return;
    }

    setCreating(true);
    try {
      await onCreateFolder(newFolderName.trim(), selectedColor);
      setNewFolderName('');
      setSelectedColor('#3B82F6');
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (folder.count > 0) {
      if (!confirm(`文件夹"${folder.name}"中有 ${folder.count} 个文档，删除后这些文档将被移至"未分类"。确定要删除吗？`)) {
        return;
      }
    } else {
      if (!confirm(`确定要删除文件夹"${folder.name}"吗？`)) {
        return;
      }
    }

    setDeleting(folder.id);
    try {
      await onDeleteFolder(folder.id);
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            文件夹管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 新建文件夹 */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium text-sm">新建文件夹</h3>
            <div className="space-y-2">
              <Input
                placeholder="文件夹名称"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">选择颜色</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        selectedColor === color
                          ? 'ring-2 ring-offset-2 ring-primary scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Button
                onClick={handleCreateFolder}
                disabled={creating || !newFolderName.trim()}
                className="w-full"
              >
                {creating ? '创建中...' : '创建文件夹'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* 文件夹列表 */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm">现有文件夹</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {folders.filter(f => f.name !== '全部' && f.name !== '未分类').map(folder => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: folder.color }}
                    />
                    <div>
                      <div className="font-medium text-sm">{folder.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {folder.count} 个文档
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFolder(folder)}
                    disabled={deleting === folder.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deleting === folder.id ? (
                      <>删除中...</>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              ))}
              {folders.filter(f => f.name !== '全部' && f.name !== '未分类').length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  还没有创建任何文件夹
                </div>
              )}
            </div>
          </div>

          {/* 默认文件夹说明 */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
            💡 提示："全部"和"未分类"是系统默认文件夹，不能删除
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
