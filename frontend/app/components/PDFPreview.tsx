import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 worker - 使用兼容版本
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PDFPreviewProps {
  url: string;
  onClose?: () => void;
}

export function PDFPreview({ url, onClose }: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [useFallback, setUseFallback] = useState(false);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    // 始终尝试使用 PDF.js 加载，如果失败会自动切换到备用方案
    loadPDF();

    return () => {
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [url]);

  useEffect(() => {
    if (pdf && !useFallback) {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, scale, useFallback]);

  const loadPDF = async () => {
    setLoading(true);
    setError(null);

    try {
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cspOpenerPolicy: 'no-window'
      });

      // 设置超时，防止无限等待
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('加载超时')), 15000);
      });

      const pdfDoc = await Promise.race([loadingTask.promise, timeoutPromise]);
      setPdf(pdfDoc);
      pdfRef.current = pdfDoc;
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
      setLoading(false);
    } catch (err: any) {
      console.error('加载 PDF 失败:', err);
      // 任何加载错误都使用备用方案
      setUseFallback(true);
      setLoading(false);
    }
  };

  const renderPage = async (pageNum: number) => {
    if (!pdf || !canvasRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('渲染页面失败:', err);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const openInNewTab = () => {
    window.open(url, '_blank');
  };

  // 使用备用方案（iframe 或新标签页打开）
  if (useFallback) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <span className="text-sm text-amber-600">由于浏览器安全限制，无法直接预览此 PDF</span>
          <div className="flex gap-2">
            <button
              onClick={openInNewTab}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              在新标签页打开
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                关闭
              </button>
            )}
          </div>
        </div>
        {/* 尝试显示 iframe（某些网站可能允许） */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          <iframe
            src={url}
            className="w-full h-full border-0"
            title="PDF Preview"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
        {/* 底部提示 */}
        <div className="px-4 py-2 bg-gray-50 border-t text-center">
          <span className="text-xs text-gray-500">
            如果上述方法都无法查看PDF，请点击"在新标签页打开"下载或查看
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="px-3 py-1 text-sm bg-white border rounded"
          >
            缩小
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            className="px-3 py-1 text-sm bg-white border rounded"
          >
            放大
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={openInNewTab}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
          >
            新标签页打开
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded"
            >
              关闭
            </button>
          )}
        </div>
      </div>

      {/* PDF 内容 */}
      <div className="flex-1 overflow-auto bg-gray-200 p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">加载中...</div>
          </div>
        )}

        {!loading && !error && !useFallback && (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
}
