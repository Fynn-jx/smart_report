"""
文档管理 API（本地存储模式）
只存储文档索引，文件保存在用户本地

使用直接的 HTTP 请求访问 Supabase REST API，绕过 DNS 解析问题
"""
import os
import json
import uuid
import requests
from datetime import datetime
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
STORAGE_BUCKET_NAME = "documents"  # 存储桶名称

print(f"[DEBUG] Supabase URL: {SUPABASE_URL}")
print(f"[DEBUG] Supabase Key: {SUPABASE_KEY[:20]}...")

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
    """
    直接发送 HTTP 请求到 Supabase REST API
    """
    url = f"{SUPABASE_REST_URL}/{table}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data, params=params)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, params=params)
        else:
            raise ValueError(f"Unsupported method: {method}")

        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Supabase request failed: {e}")
        raise Exception(f"Supabase request failed: {e}")


def get_storage_url(file_path):
    """获取存储文件的公开URL"""
    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET_NAME}/{file_path}"


def register_document_routes(app):
    """注册文档管理路由"""

    @app.route('/api/documents/index', methods=['POST'])
    def create_document_index():
        """
        创建文档索引（不存储文件）

        请求参数：
        - title: 文档标题
        - filename: 文件名
        - source_url: 来源URL（可选）
        - tags: 标签数组（可选）
        - folder: 文件夹（可选）
        """
        try:
            data = request.get_json()

            user_id = data.get('user_id', 'default')
            title = data.get('title', 'Untitled Document')
            filename = data.get('filename', '')
            source_url = data.get('source_url', '')
            tags = data.get('tags', [])
            folder = data.get('folder', '其他')
            source_type = data.get('source_type', 'manual')  # plugin/manual

            # 生成唯一ID
            doc_id = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

            document_data = {
                "id": doc_id,
                "user_id": user_id,
                "title": title,
                "filename": filename or title,
                "source_url": source_url,
                "source_type": source_type,
                "tags": tags,
                "folder": folder,
                "notes": None,
                "conversion_history": None,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }

            response = supabase_request("POST", "documents", document_data)

            if response.status_code in [200, 201]:
                return jsonify({
                    "success": True,
                    "document": response.json()[0] if response.json() else document_data,
                    "message": "Document index created"
                }), 200
            else:
                return jsonify({"error": f"Failed to create index: {response.text}"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents', methods=['GET'])
    def get_documents():
        """获取文档列表（分页、筛选）"""
        try:
            user_id = request.args.get('user_id', 'default')
            folder = request.args.get('folder')
            tag = request.args.get('tag')
            search = request.args.get('search')
            website = request.args.get('website')  # 按来源网站筛选
            limit = int(request.args.get('limit', 50))

            # 构建查询参数
            params = {
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "limit": limit
            }

            if folder:
                params["folder"] = f"eq.{folder}"

            response = supabase_request("GET", "documents", params=params)
            documents = response.json()

            # 规范化标签为纯字符串（Supabase可能返回对象格式）
            for doc in documents:
                if 'tags' in doc and doc['tags']:
                    normalized_tags = []
                    for tag in doc['tags']:
                        if isinstance(tag, dict) and 'label' in tag:
                            normalized_tags.append(tag['label'])
                        else:
                            normalized_tags.append(str(tag))
                    doc['tags'] = normalized_tags

            # 客户端标签筛选
            if tag:
                documents = [d for d in documents if tag in (d.get('tags') or [])]

            # 按来源网站筛选
            if website:
                documents = [d for d in documents if d.get('source_url') and website.lower() in d.get('source_url', '').lower()]

            # 客户端搜索
            if search:
                search_lower = search.lower()
                documents = [
                    d for d in documents
                    if search_lower in d.get('title', '').lower()
                    or search_lower in d.get('filename', '').lower()
                    or (d.get('notes') and search_lower in d.get('notes', '').lower())
                ]

            return jsonify({
                "success": True,
                "documents": documents,
                "count": len(documents)
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>', methods=['GET'])
    def get_document(doc_id):
        """获取单个文档详情"""
        try:
            params = {"id": f"eq.{doc_id}", "limit": 1}
            response = supabase_request("GET", "documents", params=params)
            documents = response.json()

            if documents:
                return jsonify({
                    "success": True,
                    "document": documents[0]
                }), 200
            else:
                return jsonify({"error": "Document not found"}), 404

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>/url', methods=['GET'])
    def get_document_url(doc_id):
        """获取文档的预览URL"""
        try:
            params = {"id": f"eq.{doc_id}", "limit": 1}
            response = supabase_request("GET", "documents", params=params)
            documents = response.json()

            if not documents:
                return jsonify({"error": "Document not found"}), 404

            doc = documents[0]

            # 如果有 source_url，都尝试使用 PDF.js 预览
            if doc.get('source_url'):
                source_url = doc['source_url']
                # 尝试使用 PDF.js 预览，让前端处理加载失败的情况
                return jsonify({
                    "success": True,
                    "url": source_url,
                    "type": "preview"
                }), 200

            # 否则返回存储桶中的文件URL
            # 文件名存储在 filename 字段中
            filename = doc.get('filename')
            if filename:
                file_url = get_storage_url(filename)
                return jsonify({
                    "success": True,
                    "url": file_url,
                    "type": "storage"
                }), 200

            return jsonify({"error": "No URL available for this document"}), 404

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/documents/<doc_id>/download', methods=['GET'])
    def download_document(doc_id):
        """代理下载文档（解决跨域问题）"""
        try:
            # 先获取文档信息
            params = {"id": f"eq.{doc_id}", "limit": 1}
            response = supabase_request("GET", "documents", params=params)
            documents = response.json()

            if not documents:
                return jsonify({"error": "Document not found"}), 404

            doc = documents[0]

            # 获取文件 URL
            file_url = None
            filename = doc.get('filename', 'document.pdf')

            if doc.get('source_url'):
                file_url = doc['source_url']
            elif filename:
                file_url = get_storage_url(filename)

            if not file_url:
                return jsonify({"error": "No file available"}), 404

            # 通过后端代理下载
            import requests
            file_response = requests.get(file_url, timeout=30)

            if file_response.status_code != 200:
                return jsonify({"error": f"Failed to download: {file_response.status_code}"}), 500

            # 返回文件，添加 CORS 相关头
            from flask import Response
            return Response(
                file_response.content,
                mimetype='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            )

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>', methods=['PATCH'])
    def update_document(doc_id):
        """更新文档信息（标题、标签、笔记等）"""
        try:
            data = request.get_json()

            update_data = {
                "updated_at": datetime.now().isoformat()
            }

            # 允许更新的字段
            if 'title' in data:
                update_data['title'] = data['title']
            if 'tags' in data:
                update_data['tags'] = data['tags']
            if 'notes' in data:
                update_data['notes'] = data['notes']
            if 'folder' in data:
                update_data['folder'] = data['folder']

            params = {"id": f"eq.{doc_id}"}
            response = supabase_request("PATCH", "documents", update_data, params)

            if response.status_code in [200, 204] or response.json():
                return jsonify({
                    "success": True,
                    "document": response.json()[0] if response.json() else update_data
                }), 200
            else:
                return jsonify({"error": "Update failed"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>', methods=['DELETE'])
    def delete_document(doc_id):
        """删除文档索引（文件仍在本地）"""
        try:
            params = {"id": f"eq.{doc_id}"}
            supabase_request("DELETE", "documents", params=params)

            return jsonify({
                "success": True,
                "message": "Document index deleted (file remains on local disk)"
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/plugin/save', methods=['POST'])
    def plugin_save_document():
        """
        浏览器插件保存文档索引

        请求参数：
        - url: 文档URL
        - title: 文档标题
        - folder: 保存到哪个文件夹（可选，默认"其他"）
        - tags: 标签数组（可选）
        - source_type: 'plugin'（标识来自插件）
        """
        try:
            data = request.get_json()

            url = data.get('url')
            title = data.get('title')
            user_id = data.get('user_id', 'default')
            folder = data.get('folder', '其他')  # 支持指定文件夹
            tags = data.get('tags', ['网页保存'])   # 支持指定标签

            if not url or not title:
                return jsonify({"error": "URL and title are required"}), 400

            # 提取文件名
            filename = url.split('/')[-1]
            if not filename or '.' not in filename:
                filename = f"{title}.pdf"

            # 创建索引（不下载文件，由浏览器插件下载到本地）
            doc_id = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

            document_data = {
                "id": doc_id,
                "user_id": user_id,
                "title": title,
                "filename": filename,
                "source_url": url,
                "source_type": "plugin",
                "tags": tags,
                "folder": folder,  # 使用指定的文件夹
                "notes": None,
                "conversion_history": None,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }

            response = supabase_request("POST", "documents", document_data)

            if response.status_code in [200, 201]:
                return jsonify({
                    "success": True,
                    "document": response.json()[0] if response.json() else document_data,
                    "message": f"Document saved to folder '{folder}'"
                }), 200
            else:
                return jsonify({"error": f"Failed to create index: {response.text}"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/folders', methods=['GET'])
    def get_folders():
        """获取用户的所有文件夹"""
        try:
            user_id = request.args.get('user_id', 'default')

            # 测试 Supabase 连接
            try:
                params = {"user_id": f"eq.{user_id}"}
                response = supabase_request("GET", "folders", params=params)
                folders = response.json()
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": f"Supabase连接失败: {str(e)}",
                    "hint": "请检查网络连接或 Supabase 配置"
                }), 500

            # 只使用默认文件夹（按学科领域分类），不显示用户创建的旧文件夹
            default_folders = [
                {"id": "default", "name": "全部", "count": 0},
                {"id": "finance", "name": "金融经济", "count": 0, "color": "#059669"},
                {"id": "trade", "name": "国际贸易", "count": 0, "color": "#2563EB"},
                {"id": "international", "name": "国际关系", "count": 0, "color": "#DC2626"},
                {"id": "law", "name": "法律政策", "count": 0, "color": "#7C3AED"},
                {"id": "statistics", "name": "统计资料", "count": 0, "color": "#0891B2"},
                {"id": "other", "name": "其他", "count": 0, "color": "#6B7280"},
            ]

            # 统计每个文件夹的文档数
            docs_params = {"user_id": f"eq.{user_id}", "select": "folder"}
            docs_response = supabase_request("GET", "documents", params=docs_params)
            docs = docs_response.json()

            folder_counts = {}
            for doc in docs:
                folder = doc.get('folder', '其他')
                folder_counts[folder] = folder_counts.get(folder, 0) + 1

            # 更新计数
            for folder in default_folders:
                if folder['name'] == '其他':
                    folder['count'] = folder_counts.get('其他', 0)
                elif folder['name'] == '全部':
                    folder['count'] = sum(folder_counts.values())

            return jsonify({
                "success": True,
                "folders": default_folders
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/folders', methods=['POST'])
    def create_folder():
        """创建新文件夹"""
        try:
            data = request.get_json()

            user_id = data.get('user_id', 'default')
            name = data.get('name')
            color = data.get('color', '#3B82F6')
            parent_id = data.get('parent_id')

            if not name:
                return jsonify({"error": "Folder name is required"}), 400

            folder_id = f"folder_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

            folder_data = {
                "id": folder_id,
                "user_id": user_id,
                "name": name,
                "color": color,
                "parent_id": parent_id,
                "created_at": datetime.now().isoformat()
            }

            response = supabase_request("POST", "folders", folder_data)

            if response.status_code in [200, 201]:
                return jsonify({
                    "success": True,
                    "folder": response.json()[0]
                }), 200
            else:
                return jsonify({"error": "Failed to create folder"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/stats', methods=['GET'])
    def get_document_stats():
        """获取文档统计信息"""
        try:
            user_id = request.args.get('user_id', 'default')

            params = {"user_id": f"eq.{user_id}"}
            response = supabase_request("GET", "documents", params=params)
            documents = response.json()

            # 统计信息
            stats = {
                "total": len(documents),
                "by_source": {
                    "plugin": len([d for d in documents if d.get('source_type') == 'plugin']),
                    "manual": len([d for d in documents if d.get('source_type') == 'manual']),
                    "upload": len([d for d in documents if d.get('source_type') == 'upload'])
                },
                "by_type": {},
                "recent_count": len([d for d in documents if (datetime.now() - datetime.fromisoformat(d['created_at'].replace('Z', '+00:00')).replace(tzinfo=None)).days < 7])
            }

            # 按文件类型统计
            for doc in documents:
                file_type = doc.get('file_type', 'unknown')
                stats['by_type'][file_type] = stats['by_type'].get(file_type, 0) + 1

            return jsonify({
                "success": True,
                "stats": stats
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/websites', methods=['GET'])
    def get_websites():
        """获取用户文档的所有来源网站"""
        try:
            user_id = request.args.get('user_id', 'default')

            # 获取所有文档
            params = {"user_id": f"eq.{user_id}", "select": "source_url"}
            response = supabase_request("GET", "documents", params=params)
            documents = response.json()

            # 预定义所有已知网站（包含没有文档的）
            known_websites = [
                {'key': 'worldbank.org', 'name': '世界银行'},
                {'key': 'imf.org', 'name': 'IMF国际货币基金组织'},
                {'key': 'un.org', 'name': '联合国'},
                {'key': 'unea', 'name': '联合国非洲经济委员会'},
                {'key': 'uneca', 'name': '联合国非洲经济委员会'},
                {'key': 'afdb.org', 'name': '非洲开发银行'},
                {'key': 'wto.org', 'name': 'WTO世贸组织'},
                {'key': 'oecd.org', 'name': 'OECD经合组织'},
                {'key': 'nielsen.com', 'name': 'Nielsen尼尔森'},
                {'key': 'mckinsey.com', 'name': '麦肯锡'},
                {'key': 'bcg.com', 'name': '波士顿咨询'},
                {'key': 'bain.com', 'name': '贝恩咨询'},
                {'key': 'centralbank.gov.cn', 'name': '中国人民银行'},
                {'key': 'stats.gov.cn', 'name': '国家统计局'},
            ]

            # 网站映射用于匹配
            website_match_map = {
                'worldbank.org': 'worldbank.org',
                'wb': 'worldbank.org',
                'imf.org': 'imf.org',
                'un.org': 'un.org',
                'unea': 'unea',
                'uneca': 'uneca',
                'afdb.org': 'afdb.org',
                'africandevelopmentbank': 'afdb.org',
                'wto.org': 'wto.org',
                'oecd.org': 'oecd.org',
                'nielsen.com': 'nielsen.com',
                'mckinsey.com': 'mckinsey.com',
                'bcg.com': 'bcg.com',
                'bain.com': 'bain.com',
                'centralbank.gov.cn': 'centralbank.gov.cn',
                'pbc.gov.cn': 'centralbank.gov.cn',
                'stats.gov.cn': 'stats.gov.cn',
            }

            # 统计每个网站的文档数
            website_counts = {w['key']: 0 for w in known_websites}

            for doc in documents:
                source_url = doc.get('source_url')
                if source_url:
                    try:
                        url_obj = __import__('urllib.parse', fromlist=['urlparse']).urlparse(source_url)
                        hostname = url_obj.netloc.lower().replace('www.', '')

                        # 查找匹配
                        for key, info_key in website_match_map.items():
                            if key in hostname:
                                website_counts[info_key] = website_counts.get(info_key, 0) + 1
                                break
                    except:
                        pass

            # 构建网站列表（包含0个文档的）
            website_list = []
            for w in known_websites:
                website_list.append({
                    "id": w['key'],
                    "name": w['name'],
                    "count": website_counts.get(w['key'], 0)
                })

            # 按数量排序
            website_list.sort(key=lambda x: x['count'], reverse=True)

            return jsonify({
                "success": True,
                "websites": website_list
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500
