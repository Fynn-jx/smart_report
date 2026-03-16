"""
文本切片工具 - 使用LangChain进行文档切片处理
"""
import io
import requests
from langchain.text_splitter import RecursiveCharacterTextSplitter
import pdfplumber


def extract_text_from_pdf(file_content: bytes) -> str:
    """从PDF文件内容提取文本"""
    text = ""

    try:
        # 使用pdfplumber打开PDF
        pdf_file = io.BytesIO(file_content)
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n\n"

        print(f"PDF提取文本长度: {len(text)} 字符")
        return text

    except Exception as e:
        print(f"PDF文本提取失败: {e}")
        return ""


def extract_text_from_url(url: str) -> str:
    """从URL下载PDF并提取文本"""
    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            return extract_text_from_pdf(response.content)
        else:
            print(f"下载PDF失败: {response.status_code}")
            return ""
    except Exception as e:
        print(f"下载PDF出错: {e}")
        return ""


def split_text_by_langchain(
    text: str,
    chunk_size: int = 3000,
    chunk_overlap: int = 300
) -> list:
    """
    使用LangChain的RecursiveCharacterTextSplitter进行文本切片

    Args:
        text: 要切片的原始文本
        chunk_size: 每个切片的最大字符数
        chunk_overlap: 相邻切片之间的重叠字符数

    Returns:
        文本切片列表
    """
    if not text:
        return []

    # 使用递归字符文本分割器
    # 按照段落、句子、单词的顺序尝试分割
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=[
            "\n\n\n",  # 三个换行（大段落分隔）
            "\n\n",    # 两个换行（段落分隔）
            "\n",      # 换行
            "。",      # 句号
            "！",      # 感叹号
            "？",      # 问号
            "；",      # 分号
            "，",      # 逗号
            " ",       # 空格
            ""         # 按字符
        ],
        length_function=len,
    )

    chunks = splitter.split_text(text)
    print(f"文本切片完成: 共 {len(chunks)} 个切片")

    return chunks


def process_long_document(
    file_content: bytes = None,
    url: str = None,
    chunk_size: int = 3000,
    chunk_overlap: int = 300
) -> dict:
    """
    处理长文档：提取文本并切片

    Args:
        file_content: PDF文件内容（字节）
        url: PDF文件的URL
        chunk_size: 切片大小
        chunk_overlap: 重叠大小

    Returns:
        {
            "success": bool,
            "full_text": str,  # 完整文本
            "chunks": list,    # 切片列表
            "chunk_count": int # 切片数量
        }
    """
    # 提取文本
    if file_content:
        full_text = extract_text_from_pdf(file_content)
    elif url:
        full_text = extract_text_from_url(url)
    else:
        return {
            "success": False,
            "error": "需要提供 file_content 或 url",
            "full_text": "",
            "chunks": [],
            "chunk_count": 0
        }

    if not full_text:
        return {
            "success": False,
            "error": "无法提取PDF文本",
            "full_text": "",
            "chunks": [],
            "chunk_count": 0
        }

    # 切片
    chunks = split_text_by_langchain(full_text, chunk_size, chunk_overlap)

    return {
        "success": True,
        "full_text": full_text,
        "chunks": chunks,
        "chunk_count": len(chunks)
    }


# 中文文本处理的分隔符配置
CHINESE_SPLITTER_CONFIG = {
    "separators": [
        "\n\n\n\n",  # 四个换行（大章节分隔）
        "\n\n\n",    # 三个换行（小章节分隔）
        "\n\n",      # 两个换行（段落分隔）
        "\n",        # 换行
        "。",        # 句号（中文最重要）
        "！",        # 感叹号
        "？",        # 问号
        "；",        # 分号
        "，",        # 逗号
        " ",         # 空格
        ""           # 按字符
    ]
}


def split_chinese_text(text: str, chunk_size: int = 3000, chunk_overlap: int = 300) -> list:
    """专门针对中文文本进行优化切片"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        **CHINESE_SPLITTER_CONFIG,
        length_function=len,
    )
    return splitter.split_text(text)
