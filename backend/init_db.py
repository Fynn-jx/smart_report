"""
数据库初始化脚本
运行此脚本会自动在 Supabase 中创建 documents 和 folders 表

使用直接的 HTTP 请求访问 Supabase REST API，绕过 DNS 解析问题
"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Supabase REST API 端点
SUPABASE_REST_URL = f"{SUPABASE_URL}/rest/v1"

# 设置请求头
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def supabase_request(method, table, data=None, params=None):
    """直接发送 HTTP 请求到 Supabase REST API"""
    url = f"{SUPABASE_REST_URL}/{table}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        return response
    except requests.exceptions.RequestException as e:
        raise Exception(f"Supabase request failed: {e}")


def init_database():
    """初始化数据库表"""
    print("开始初始化数据库...")
    print(f"Supabase URL: {SUPABASE_URL}")

    # 1. 检查并创建 folders 表
    try:
        params = {"limit": 1}
        supabase_request("GET", "folders", params=params)
        print("✓ folders 表已存在")
    except Exception as e:
        print(f"  注意: {e}")
        print("  请在 Supabase SQL Editor 中手动执行以下 SQL:")
        print("-" * 40)
        print("""
-- 创建文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',
    name VARCHAR(200) NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    parent_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        """)
        print("-" * 40)

    # 2. 检查并创建 documents 表
    try:
        params = {"limit": 1}
        supabase_request("GET", "documents", params=params)
        print("✓ documents 表已存在")
    except Exception as e:
        print(f"  注意: {e}")
        print("  请在 Supabase SQL Editor 中手动执行以下 SQL:")
        print("-" * 40)
        print("""
-- 创建文档表
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',
    title VARCHAR(500) NOT NULL,
    filename VARCHAR(500),
    source_url TEXT,
    source_type VARCHAR(20) DEFAULT 'manual',
    tags TEXT[] DEFAULT '{}',
    folder VARCHAR(200) DEFAULT '未分类',
    notes TEXT,
    conversion_history TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        """)
        print("-" * 40)

    # 3. 尝试插入默认文件夹
    default_folders = [
        {'id': 'folder_1', 'user_id': 'default', 'name': '金融经济', 'color': '#059669'},
        {'id': 'folder_2', 'user_id': 'default', 'name': '国际贸易', 'color': '#2563EB'},
        {'id': 'folder_3', 'user_id': 'default', 'name': '国际关系', 'color': '#DC2626'},
        {'id': 'folder_4', 'user_id': 'default', 'name': '法律政策', 'color': '#7C3AED'},
        {'id': 'folder_5', 'user_id': 'default', 'name': '统计资料', 'color': '#0891B2'},
        {'id': 'folder_6', 'user_id': 'default', 'name': '其他', 'color': '#6B7280'},
    ]

    for folder in default_folders:
        try:
            supabase_request("POST", "folders", folder)
            print(f"✓ 添加文件夹: {folder['name']}")
        except Exception as e:
            # 忽略已存在的错误
            if 'duplicate' not in str(e).lower():
                print(f"  注意: {folder['name']} - {e}")
            else:
                print(f"✓ 文件夹已存在: {folder['name']}")

    # 检查表状态
    print("\n检查表状态...")

    # 检查 folders 表
    try:
        response = supabase_request("GET", "folders")
        data = response.json()
        print(f"✓ folders 表: 存在 ({len(data)} 条记录)")
    except Exception as e:
        print(f"✗ folders 表: 不存在或无法访问 - {e}")

    # 检查 documents 表
    try:
        params = {"limit": 1}
        supabase_request("GET", "documents", params=params)
        print(f"✓ documents 表: 存在")
    except Exception as e:
        print(f"✗ documents 表: 不存在或无法访问 - {e}")

    print("\n初始化完成！")


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("错误: 请在 .env 文件中配置 SUPABASE_URL 和 SUPABASE_KEY")
        sys.exit(1)

    init_database()
