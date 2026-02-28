"""
文档管理 API（本地存储模式）
只存储文档索引，文件保存在用户本地
"""
import os
import json
import uuid
from datetime import datetime
from flask import request, jsonify
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# 初始化 Supabase 客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


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
            folder = data.get('folder', '未分类')
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

            result = supabase.table("documents").insert(document_data).execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "document": result.data[0],
                    "message": "Document index created"
                }), 200
            else:
                return jsonify({"error": "Failed to create index"}), 500

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
            limit = int(request.args.get('limit', 50))

            query = supabase.table("documents").select("*").eq("user_id", user_id)

            if folder:
                query = query.eq("folder", folder)

            # 应用筛选
            result = query.order("created_at", desc=True).limit(limit).execute()

            documents = result.data

            # 客户端标签筛选
            if tag:
                documents = [d for d in documents if tag in (d.get('tags') or [])]

            # 客户端搜索
            if search:
                search_lower = search.lower()
                documents = [
                    d for d in documents
                    if search_lower in d.get('title', '').lower()
                    or search_lower in d.get('filename', '').lower()
                    or search_lower in d.get('notes', '').lower()
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
            result = supabase.table("documents").select("*").eq("id", doc_id).execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "document": result.data[0]
                }), 200
            else:
                return jsonify({"error": "Document not found"}), 404

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

            result = supabase.table("documents").update(update_data).eq("id", doc_id).execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "document": result.data[0]
                }), 200
            else:
                return jsonify({"error": "Update failed"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>', methods=['DELETE'])
    def delete_document(doc_id):
        """删除文档索引（文件仍在本地）"""
        try:
            supabase.table("documents").delete().eq("id", doc_id).execute()

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
        - source_type: 'plugin'（标识来自插件）
        """
        try:
            data = request.get_json()

            url = data.get('url')
            title = data.get('title')
            user_id = data.get('user_id', 'default')

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
                "tags": ["网页保存"],
                "folder": "未分类",
                "notes": None,
                "conversion_history": None,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }

            result = supabase.table("documents").insert(document_data).execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "document": result.data[0],
                    "message": "Document indexed (file downloaded to local by browser)"
                }), 200
            else:
                return jsonify({"error": "Failed to create index"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/folders', methods=['GET'])
    def get_folders():
        """获取用户的所有文件夹"""
        try:
            user_id = request.args.get('user_id', 'default')

            result = supabase.table("folders").select("*").eq("user_id", user_id).execute()

            # 添加默认文件夹
            folders = result.data
            default_folders = [
                {"id": "default", "name": "全部", "count": 0},
                {"id": "uncategorized", "name": "未分类", "count": 0},
            ]

            # 统计每个文件夹的文档数
            docs_result = supabase.table("documents").select("folder").eq("user_id", user_id).execute()
            folder_counts = {}
            for doc in docs_result.data:
                folder = doc.get('folder', '未分类')
                folder_counts[folder] = folder_counts.get(folder, 0) + 1

            # 更新计数
            for folder in default_folders:
                if folder['name'] == '未分类':
                    folder['count'] = folder_counts.get('未分类', 0)
                elif folder['name'] == '全部':
                    folder['count'] = sum(folder_counts.values())

            for folder in folders:
                folder['count'] = folder_counts.get(folder['name'], 0)
                default_folders.append(folder)

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

            result = supabase.table("folders").insert(folder_data).execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "folder": result.data[0]
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

            result = supabase.table("documents").select("*").eq("user_id", user_id).execute()
            documents = result.data

            # 统计信息
            stats = {
                "total": len(documents),
                "by_source": {
                    "plugin": len([d for d in documents if d.get('source_type') == 'plugin']),
                    "manual": len([d for d in documents if d.get('source_type') == 'manual']),
                    "upload": len([d for d in documents if d.get('source_type') == 'upload'])
                },
                "by_type": {},
                "recent_count": len([d for d in documents if (datetime.now() - datetime.fromisoformat(d['created_at'].replace('Z', '+00:00'))).days < 7])
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
