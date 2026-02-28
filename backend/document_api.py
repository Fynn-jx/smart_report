"""
文档管理 API - Supabase Storage 集成
"""
import os
import uuid
from datetime import datetime
from flask import request, jsonify, send_file
from werkzeug.utils import secure_filename
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Supabase Storage 配置
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
STORAGE_BUCKET_NAME = "documents"  # 存储桶名称

# 允许的文件类型
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'rtf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# 初始化 Supabase 客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_storage_url(file_path):
    """获取文件的公开访问URL"""
    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET_NAME}/{file_path}"


# ============= API 路由 =============

def register_document_routes(app):
    """注册文档管理路由到 Flask 应用"""

    @app.route('/api/documents/upload', methods=['POST'])
    def upload_document():
        """上传文档到 Supabase Storage"""
        try:
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400

            file = request.files['file']
            user_id = request.form.get('user_id', 'default')
            title = request.form.get('title', file.filename)
            source_url = request.form.get('source_url', '')
            metadata = request.form.get('metadata', '{}')

            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400

            if not allowed_file(file.filename):
                return jsonify({"error": "Invalid file type"}), 400

            # 读取文件内容
            file_content = file.read()
            file_size = len(file_content)

            if file_size > MAX_FILE_SIZE:
                return jsonify({"error": "File too large"}), 400

            # 生成唯一文件名
            file_ext = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{user_id}/{uuid.uuid4()}.{file_ext}"

            # 上传到 Supabase Storage
            try:
                # 直接使用 REST API 上传
                storage_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET_NAME}/{unique_filename}"
                headers = {
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": file.content_type
                }

                response = requests.post(
                    storage_url,
                    headers=headers,
                    data=file_content
                )

                if response.status_code not in [200, 201]:
                    return jsonify({"error": f"Upload failed: {response.text}"}), 500

                # 获取公开URL
                public_url = get_storage_url(unique_filename)

                # 保存元数据到数据库
                doc_id = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

                document_data = {
                    "id": doc_id,
                    "user_id": user_id,
                    "title": title,
                    "filename": file.filename,
                    "file_path": unique_filename,
                    "file_url": public_url,
                    "file_size": file_size,
                    "file_type": file_ext,
                    "source_url": source_url,
                    "metadata": metadata,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat()
                }

                # 保存到 documents 表
                result = supabase.table("documents").insert(document_data).execute()

                if result.data:
                    return jsonify({
                        "success": True,
                        "document": result.data[0],
                        "message": "Document uploaded successfully"
                    }), 200
                else:
                    return jsonify({"error": "Failed to save metadata"}), 500

            except Exception as e:
                return jsonify({"error": f"Upload error: {str(e)}"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents', methods=['GET'])
    def get_documents():
        """获取用户的所有文档"""
        try:
            user_id = request.args.get('user_id', 'default')
            limit = int(request.args.get('limit', 50))
            offset = int(request.args.get('offset', 0))

            result = supabase.table("documents") \
                .select("*") \
                .eq("user_id", user_id) \
                .order("created_at", desc=True) \
                .range(offset, offset + limit - 1) \
                .execute()

            return jsonify({
                "success": True,
                "documents": result.data,
                "count": len(result.data)
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>', methods=['GET'])
    def get_document(doc_id):
        """获取单个文档详情"""
        try:
            result = supabase.table("documents") \
                .select("*") \
                .eq("id", doc_id) \
                .execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "document": result.data[0]
                }), 200
            else:
                return jsonify({"error": "Document not found"}), 404

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>', methods=['DELETE'])
    def delete_document(doc_id):
        """删除文档"""
        try:
            # 获取文档信息
            result = supabase.table("documents") \
                .select("file_path") \
                .eq("id", doc_id) \
                .execute()

            if not result.data:
                return jsonify({"error": "Document not found"}), 404

            file_path = result.data[0]["file_path"]

            # 从 Storage 删除文件
            storage_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET_NAME}/{file_path}"
            headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}

            delete_response = requests.delete(storage_url, headers=headers)

            # 从数据库删除记录
            supabase.table("documents").delete().eq("id", doc_id).execute()

            return jsonify({
                "success": True,
                "message": "Document deleted successfully"
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/documents/<doc_id>/update', methods=['PATCH'])
    def update_document(doc_id):
        """更新文档元数据"""
        try:
            data = request.get_json()

            update_data = {
                "updated_at": datetime.now().isoformat()
            }

            if 'title' in data:
                update_data['title'] = data['title']
            if 'metadata' in data:
                update_data['metadata'] = data['metadata']

            result = supabase.table("documents") \
                .update(update_data) \
                .eq("id", doc_id) \
                .execute()

            if result.data:
                return jsonify({
                    "success": True,
                    "document": result.data[0]
                }), 200
            else:
                return jsonify({"error": "Update failed"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/api/plugin/save', methods=['POST'])
    def plugin_save_document():
        """浏览器插件保存文档接口"""
        try:
            data = request.get_json()

            url = data.get('url')
            user_id = data.get('user_id', 'default')
            title = data.get('title', 'Document')

            if not url:
                return jsonify({"error": "URL is required"}), 400

            # 下载文件
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()

                file_content = response.content
                file_size = len(file_content)

                # 从URL或Content-Type确定文件类型
                file_ext = 'pdf'  # 默认
                content_type = response.headers.get('Content-Type', '')

                if 'pdf' in content_type.lower() or url.lower().endswith('.pdf'):
                    file_ext = 'pdf'
                elif 'word' in content_type.lower() or url.lower().endswith('.docx'):
                    file_ext = 'docx'
                elif 'msword' in content_type.lower() or url.lower().endswith('.doc'):
                    file_ext = 'doc'

                # 生成唯一文件名
                unique_filename = f"plugin/{user_id}/{uuid.uuid4()}.{file_ext}"

                # 上传到 Supabase Storage
                storage_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET_NAME}/{unique_filename}"
                headers = {
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": content_type
                }

                upload_response = requests.post(
                    storage_url,
                    headers=headers,
                    data=file_content
                )

                if upload_response.status_code not in [200, 201]:
                    return jsonify({"error": "Upload failed"}), 500

                # 获取公开URL
                public_url = get_storage_url(unique_filename)

                # 保存元数据
                doc_id = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

                document_data = {
                    "id": doc_id,
                    "user_id": user_id,
                    "title": title,
                    "filename": url.split('/')[-1],
                    "file_path": unique_filename,
                    "file_url": public_url,
                    "file_size": file_size,
                    "file_type": file_ext,
                    "source_url": url,
                    "metadata": "{}",
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat()
                }

                result = supabase.table("documents").insert(document_data).execute()

                if result.data:
                    return jsonify({
                        "success": True,
                        "document": result.data[0],
                        "message": "Document saved successfully"
                    }), 200
                else:
                    return jsonify({"error": "Failed to save metadata"}), 500

            except requests.RequestException as e:
                return jsonify({"error": f"Failed to download: {str(e)}"}), 500

        except Exception as e:
            return jsonify({"error": str(e)}), 500
