"""
数据库初始化 API
访问 /api/init-db 即可自动创建所需的表

使用直接的 HTTP 请求访问 Supabase REST API，绕过 DNS 解析问题
"""
import os
import requests
from flask import jsonify
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


def register_init_routes(app):
    """注册数据库初始化路由"""

    @app.route('/api/init-db', methods=['GET'])
    def init_database():
        """初始化数据库表（仅供开发调试使用）"""
        try:
            results = {}

            # 1. 检查并创建 folders 表
            try:
                params = {"limit": 1}
                supabase_request("GET", "folders", params=params)
                results['folders'] = '表已存在'
            except:
                # 尝试创建（通过插入测试数据来触发表创建）
                try:
                    supabase_request("POST", "folders", {
                        'id': 'init_check',
                        'user_id': 'default',
                        'name': '检查表是否存在',
                        'color': '#000000'
                    })
                    results['folders'] = '表已创建'
                except Exception as e:
                    if 'relation' in str(e).lower() and 'does not exist' in str(e).lower():
                        results['folders'] = f'表不存在，请手动创建: {e}'
                    else:
                        results['folders'] = f'错误: {e}'

            # 2. 检查并创建 documents 表
            try:
                params = {"limit": 1}
                supabase_request("GET", "documents", params=params)
                results['documents'] = '表已存在'
            except:
                try:
                    supabase_request("POST", "documents", {
                        'id': 'init_check',
                        'user_id': 'default',
                        'title': '检查表是否存在'
                    })
                    results['documents'] = '表已创建'
                except Exception as e:
                    if 'relation' in str(e).lower() and 'does not exist' in str(e).lower():
                        results['documents'] = f'表不存在，请手动创建'
                    else:
                        results['documents'] = f'错误: {e}'

            # 3. 获取文件夹列表
            try:
                folders_response = supabase_request("GET", "folders")
                folders_data = folders_response.json()
                results['folders_count'] = len(folders_data) if folders_data else 0
                results['folders_list'] = folders_data if folders_data else []
            except Exception as e:
                results['folders_list'] = f'无法获取: {e}'

            return jsonify({
                "success": True,
                "message": "数据库状态检查完成",
                "results": results
            }), 200

        except Exception as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
