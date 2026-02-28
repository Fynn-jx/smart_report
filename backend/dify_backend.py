import os
import requests
import json
import time
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from typing import Optional, Generator
from datetime import datetime
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# ============= 配置区域 =============
ACADEMIC_TO_OFFICIAL_API_KEY = "app-yVGdpuEwALJTY7CeSkxuNpDo"  # Dify API Key for 学术报告转公文
COUNTRY_SITUATION_API_KEY = "app-IWiuVAJEEBP8zoDUOME7XKKG"  # Dify API Key for 国别情况报告
QUARTERLY_REPORT_API_KEY = "app-IzeCySdSIPnMPXGakcgZU4Ry"  # Dify API Key for 季度研究报告
TRANSLATE_API_KEY = "app-nWremBnU8z7Dq4fm6RXGU2fp"  # Dify API Key for 文档翻译
DIFY_BASE_URL = "https://api.dify.ai/v1"
APP_ID = "Dify"  # Dify App ID

# 后端配置
BACKEND_PORT = 5000
FEEDBACK_FILE = 'feedbacks.json'  # 反馈数据存储文件（备用）

# 处理参数
UPLOAD_TIMEOUT = 120      # 文件上传超时（秒）
WORKFLOW_TIMEOUT = 1800   # 工作流执行超时（秒），增加到30分钟

# 日志配置
LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "conversion.log")
# =====================================

# 确保日志目录存在
os.makedirs(LOG_DIR, exist_ok=True)

def write_log(message):
    """写入日志文件"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}\n"
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_entry)
    # 安全地打印到控制台，避免编码错误
    try:
        print(message)
    except UnicodeEncodeError:
        # 如果有编码错误，使用 ASCII 替代
        safe_message = message.encode('ascii', errors='ignore').decode('ascii')
        print(safe_message)

# 导入 Supabase 客户端（放在 write_log 之后）
try:
    from supabase_client import db
    SUPABASE_ENABLED = True
    write_log("[OK] Supabase database enabled")
except Exception as e:
    SUPABASE_ENABLED = False
    print(f"[WARN] Supabase not configured, using file storage: {e}")


# ============= 反馈功能 =============

def load_feedbacks():
    """加载所有反馈"""
    if not os.path.exists(FEEDBACK_FILE):
        return []
    try:
        with open(FEEDBACK_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        write_log(f"加载反馈文件失败: {e}")
        return []


def save_feedback(feedback_data):
    """保存反馈到文件"""
    try:
        feedbacks = load_feedbacks()
        feedbacks.append(feedback_data)
        with open(FEEDBACK_FILE, 'w', encoding='utf-8') as f:
            json.dump(feedbacks, f, ensure_ascii=False, indent=2)
        write_log(f"✓ 反馈已保存: {feedback_data.get('id')}")
        return True
    except Exception as e:
        write_log(f"✗ 保存反馈失败: {e}")
        return False


def format_feedback_type(type_value):
    """格式化反馈类型"""
    type_map = {
        'issue': '问题反馈',
        'suggestion': '功能建议',
        'other': '其他'
    }
    return type_map.get(type_value, type_value)


# ========================================

app = Flask(__name__)
CORS(app)


def init_dify_client():
    """初始化 Dify API 客户端（学术报告转公文）"""
    return DifyAPIClient(ACADEMIC_TO_OFFICIAL_API_KEY, DIFY_BASE_URL)


class DifyAPIClient:
    """Dify API 客户端类"""

    def __init__(self, api_key, base_url="https://api.dify.ai/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def upload_file(self, file, user=""):
        """
        上传文件到Dify的存储服务
        使用 /v1/files/upload 接口
        file: 可以是文件路径字符串或 FileStorage 对象
        """
        upload_url = f"{self.base_url}/files/upload"

        # 文件类型映射
        mime_types = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'rtf': 'application/rtf'
        }

        try:
            # 准备文件和数据
            if hasattr(file, 'filename'):
                # Flask FileStorage 对象
                filename = file.filename
                file.seek(0)
                ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
                mime_type = mime_types.get(ext, 'application/octet-stream')
                files = {'file': (filename, file, mime_type)}
            else:
                # 文件路径字符串
                filename = os.path.basename(file)
                ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
                mime_type = mime_types.get(ext, 'application/octet-stream')
                files = {'file': (filename, open(file, 'rb'), mime_type)}

            data = {'user': user}

            write_log(f"  上传文件到Dify: {filename}, MIME类型: {mime_type}")
            response = requests.post(upload_url, headers={'Authorization': f'Bearer {self.api_key}'},
                                       files=files, data=data, timeout=UPLOAD_TIMEOUT)

            if response.status_code in [200, 201]:
                result = response.json()
                write_log(f"  文件上传成功: {result.get('name')}, ID: {result.get('id')}")
                return result.get('id')
            else:
                write_log(f"  文件上传失败: {response.status_code}")
                write_log(f"  错误信息: {response.text}")
                return None

        except requests.exceptions.Timeout:
            write_log(f"  文件上传超时")
            return None
        except Exception as e:
            write_log(f"  文件上传异常: {e}")
            return None

    def run_workflow_blocking(self, workflow_inputs, user="", max_retries=3):
        """
        执行工作流（阻塔回复模式）
        返回最终结果
        max_retries: 最大重试次数
        """
        workflow_url = f"{self.base_url}/workflows/run"

        data = {
            "inputs": workflow_inputs,
            "response_mode": "blocking",
            "user": user
        }

        print(f"  执行工作流（阻塔回复模式）")
        print(f"输入参数: {json.dumps(workflow_inputs, ensure_ascii=False, indent=2)}")

        for attempt in range(max_retries):
            try:
                print(f"  尝试 {attempt + 1}/{max_retries}...")
                response = requests.post(workflow_url, headers=self.headers,
                                           json=data, timeout=WORKFLOW_TIMEOUT)

                if response.status_code == 200:
                    result = response.json()
                    print(f"  工作流执行成功")
                    # Dify 返回的数据结构: {"data": {"status": "...", "outputs": [...]}}
                    if 'data' in result:
                        return result['data']
                    return None
                elif response.status_code == 504:
                    print(f"  网关超时（504），准备重试...")
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 30
                        print(f"  等待 {wait_time} 秒后重试...")
                        time.sleep(wait_time)
                    continue
                else:
                    print(f"  工作流执行失败: {response.status_code}")
                    print(f"  错误信息: {response.text}")
                    return None
            except requests.exceptions.Timeout:
                print(f"  工作流执行超时")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 30
                    print(f"  等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                    continue
                return None
            except Exception as e:
                print(f"  工作流执行异常: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 30
                    print(f"  等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                    continue
                return None

        print(f"  已达到最大重试次数 {max_retries}，放弃")
        return None

    def run_workflow_streaming(self, workflow_inputs, user=""):
        """
        执行工作流（流式响应）
        使用 Server-Sent Events (SSE) 实时返回处理进度
        """
        workflow_url = f"{self.base_url}/workflows/run"

        data = {
            "inputs": workflow_inputs,
            "response_mode": "streaming",
            "user": user
        }

        print(f"  执行工作流（流式响应）")
        print(f"输入参数: {json.dumps(workflow_inputs, ensure_ascii=False, indent=2)}")

        def generate():
            try:
                response = requests.post(workflow_url, headers=self.headers,
                                           json=data,
                                           stream=True,
                                           timeout=WORKFLOW_TIMEOUT)

                if response.status_code == 200:
                    for line in response.iter_lines():
                        line = line.strip()
                        if line.startswith('data:'):
                            # 处理数据行
                            data = json.loads(line[5:])
                            print(f"  数据: {json.dumps(data, ensure_ascii=False)}")
                            yield data
                        elif line == '[DONE]':
                            print("  工作流完成")
                            break
            except requests.exceptions.Timeout:
                print("  工作流超时")
                return
            except Exception as e:
                print(f"  工作流异常: {e}")
                return

        return Response(generate(), mimetype='text/event-stream')


# ============= API 路由 ============

@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({"status": "ok", "message": "Dify API Server is running", "app_id": APP_ID})


@app.route('/api/dify/upload', methods=['POST'])
def upload_document():
    """
    上传文档到Dify
    前端通过 multipart/form-data 上传文件
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    user = request.form.get('user', 'default')

    if not file:
        return jsonify({"error": "No file selected"}), 400

    print(f"\n上传文档: {file.filename}, 用户: {user}")

    # 验证文件类型
    allowed_extensions = {'pdf', 'doc', 'docx', 'txt', 'rtf'}
    if '.' in file.filename:
        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext not in allowed_extensions:
            return jsonify({"error": "Invalid file type. Only PDF, DOC, DOCX, TXT, RTF supported"}), 400

    # 限制文件大小（最大50MB）
    file.seek(0, os.SEEK_END)
    file_size = file.tell() / (1024 * 1024)
    if file_size > 50:
        return jsonify({"error": "File too large. Maximum 50MB allowed"}), 400

    try:
        client = init_dify_client()
        file_id = client.upload_file(file, user)

        if file_id:
            return jsonify({
                "success": True,
                "file_id": file_id,
                "filename": file.filename,
                "size": file_size
            })
        else:
            return jsonify({"error": "Failed to upload file"}), 500

    except Exception as e:
        print(f"  上传异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/convert', methods=['POST'])
def convert_to_official():
    """
    调用Dify工作流进行学术报告转公文（使用流式响应避免超时）
    前端传入:
    - file_id: 上传文件后返回的ID
    - user: Dify用户标识
    - output_format: 输出格式（docx, pdf, txt等）
    """
    try:
        # 获取请求数据
        data = request.get_json()

        file_id = data.get('file_id')
        user = data.get('user', 'default')
        output_format = data.get('output_format', 'docx')
        reference_files = data.get('reference_files', [])  # 获取参考文件ID列表

        if not file_id:
            return jsonify({"error": "file_id is required"}), 400

        write_log(f"\n{'='*60}")
        write_log(f"转公文请求: file_id={file_id}, format={output_format}")
        write_log(f"参考文件数量: {len(reference_files)}")

        # ============= 创建数据库记录 =============
        # 如果启用了 Supabase，创建转换记录
        record_id = None
        if SUPABASE_ENABLED and db:
            record_id = db.create_conversion_record(
                user_id=user,
                task_type='academic_convert',
                input_file_name=data.get('file_name', 'document.pdf'),
                input_file_id=file_id,
                reference_file_name=data.get('reference_name', ''),
                reference_file_id=reference_files[0] if reference_files else None,
                extra_params={
                    'output_format': output_format,
                    'reference_files_count': len(reference_files)
                }
            )
            if record_id:
                write_log(f"Created conversion record: {record_id}")
        # =====================================

        # 构建工作流输入
        # wenjian: 必填的学术报告文件
        workflow_inputs = {
            "wenjian": {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": file_id
            }
        }

        # conference_file: 选填的参考文件
        # 如果有参考文件，添加到工作流输入中（只支持一个参考文件）
        if reference_files:
            ref_file_id = reference_files[0]  # 只取第一个参考文件
            workflow_inputs["conference_file"] = {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": ref_file_id
            }
            write_log(f"已添加参考文件 conference_file 到工作流输入")

        client = init_dify_client()
        
        # 使用流式响应避免网关超时
        write_log("使用流式响应模式...")
        workflow_url = f"{client.base_url}/workflows/run"
        request_data = {
            "inputs": workflow_inputs,
            "response_mode": "streaming",
            "user": user
        }

        response = requests.post(workflow_url, headers=client.headers,
                                   json=request_data,
                                   stream=True,
                                   timeout=WORKFLOW_TIMEOUT)

        if response.status_code != 200:
            write_log(f"工作流启动失败: {response.status_code}")
            write_log(f"错误信息: {response.text}")
            return jsonify({"error": "Failed to start workflow"}), 500

        # 收集流式响应
        outputs = []
        workflow_status = None
        all_data = []
        
        write_log("开始接收流式数据...")
        last_data_time = time.time()
        timeout_seconds = 1800  # 30分钟超时
        done_received = False
        
        for line in response.iter_lines():
            # 解码字节为字符串
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            line = line.strip()
            
            # 检查是否超时
            if time.time() - last_data_time > timeout_seconds:
                write_log(f"  接收数据超时，最后数据时间: {last_data_time}")
                break
            
            if line.startswith('data:'):
                # 解析数据行
                try:
                    data = json.loads(line[5:])
                    all_data.append(data)
                    last_data_time = time.time()
                    write_log(f"收到数据: {json.dumps(data, ensure_ascii=False)}")
                    
                    # 检查工作流状态
                    if 'status' in data:
                        workflow_status = data['status']
                        write_log(f"工作流状态: {workflow_status}")
                    
                    # 收集输出（只收集 node_finished 事件的输出）
                    if 'event' in data and data['event'] == 'node_finished':
                        if 'data' in data and 'outputs' in data['data']:
                            current_outputs = data['data']['outputs']
                            # 将新输出添加到列表中
                            if isinstance(current_outputs, dict):
                                # 如果是字典，添加所有值
                                for key, value in current_outputs.items():
                                    outputs.append(value)
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
                                # 如果是列表，添加所有元素
                                for output in current_outputs:
                                    outputs.append(output)
                                write_log(f"收到输出(列表): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 内容: {json.dumps(current_outputs, ensure_ascii=False)}")
                    
                except json.JSONDecodeError as e:
                    write_log(f"解析数据行失败: {e}, 行内容: {line}")
            
            elif line == '[DONE]':
                write_log("工作流完成")
                done_received = True
                break
        
        write_log(f"最终状态: {workflow_status}")
        write_log(f"最终输出: {len(outputs)} 个")
        write_log(f"所有数据: {len(all_data)} 条")
        write_log(f"是否收到DONE: {done_received}")
        
        # 返回最终结果
        # 检查工作流是否成功（支持多种状态值）
        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")
        
        # 如果工作流还在运行中，但有输出，也认为是成功
        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            # 使用最后一个输出
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")
            
            # 如果输出是字符串，说明是文本输出
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                output_url = output
            else:
                write_log(f"输出类型: {output.get('type')}")
                write_log(f"输出数据: {output.get('data')}")
                write_log(f"输出完整对象: {json.dumps(output, ensure_ascii=False)}")
                
                # 支持多种输出类型
                output_url = ''
                if output.get('type') == 'document':
                    output_url = output.get('data', '')
                    write_log(f"文档类型输出，URL: {output_url}")
                elif output.get('type') == 'text':
                    output_url = output.get('data', '')
                    write_log(f"文本类型输出，内容: {output_url}")
                elif 'data' in output:
                    output_url = output.get('data', '')
                    write_log(f"通用数据输出，内容: {output_url}")
                else:
                    write_log(f"未知输出类型，输出对象: {output}")
            
            if output_url:
                write_log(f"[OK] Return success, output URL: {output_url}")

                # 更新数据库记录为完成状态
                if SUPABASE_ENABLED and db and record_id:
                    db.update_conversion_record(
                        record_id=record_id,
                        status='completed',
                        output_url=output_url
                    )

                return jsonify({
                    "success": True,
                    "output_url": output_url,
                    "filename": f"converted_document.{output_format}"
                })
            else:
                write_log(f"✗ 输出URL为空，输出数据: {output}")
        
        # 如果没有输出，尝试从所有数据中查找最后的输出
        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")
                    
                    output_url = ''
                    if output.get('type') == 'document':
                        output_url = output.get('data', '')
                    elif output.get('type') == 'text':
                        output_url = output.get('data', '')
                    elif 'data' in output:
                        output_url = output.get('data', '')
                    
                    if output_url:
                        write_log(f"[OK] Found output from history, output URL: {output_url}")

                        # 更新数据库记录为完成状态
                        if SUPABASE_ENABLED and db and record_id:
                            db.update_conversion_record(
                                record_id=record_id,
                                status='completed',
                                output_url=output_url
                            )

                        return jsonify({
                            "success": True,
                            "output_url": output_url,
                            "filename": f"converted_document.{output_format}"
                        })
                    break

        write_log(f"[ERROR] Return error: status={workflow_status}, outputs={len(outputs)}")

        # 更新数据库记录为错误状态
        if SUPABASE_ENABLED and db and record_id:
            db.update_conversion_record(
                record_id=record_id,
                status='error',
                error_message=f"Workflow failed: status={workflow_status}"
            )

        return jsonify({"error": "Workflow failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"Conversion timeout")

        # 更新数据库记录为错误状态
        if SUPABASE_ENABLED and db and record_id:
            db.update_conversion_record(
                record_id=record_id,
                status='error',
                error_message="Conversion timeout"
            )

        return jsonify({"error": "Conversion timeout"}), 500

    except Exception as e:
        write_log(f"Conversion error: {e}")

        # 更新数据库记录为错误状态
        if SUPABASE_ENABLED and db and record_id:
            db.update_conversion_record(
                record_id=record_id,
                status='error',
                error_message=str(e)
            )

        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/convert-stream', methods=['POST'])
def convert_to_official_streaming():
    """
    流式版本的文档转公文接口
    提供实时处理进度
    """
    try:
        data = request.get_json()

        file_id = data.get('file_id')
        user = data.get('user', 'default')
        output_format = data.get('output_format', 'docx')

        if not file_id:
            return jsonify({"error": "file_id is required"}), 400

        print(f"\n流式转公文: file_id={file_id}")

        # 构建工作流输入
        workflow_inputs = {
            "file": {
                "type": "document",
                "transfer_method": "remote_file",
                "upload_file_id": file_id
            },
            "prompt": f"请将上传的文档转换为公文格式。要求：使用标准公文格式、正式语体、规范的版式布局。输出格式为{output_format}。"
        }

        client = init_dify_client()
        return client.run_workflow_streaming(workflow_inputs, user)

    except Exception as e:
        print(f"  流式转换异常: {e}")
        return jsonify({"error": str(e)}), 500


# 兼容性：保留原有的图片翻译接口
@app.route('/api/translate', methods=['POST'])
def translate_image():
    """
    图片翻译接口（保留原有功能）
    """
    # 这里可以保留你原来的图片翻译逻辑
    # 或者也改为使用 Dify 工作流
    return jsonify({"error": "This endpoint is deprecated. Use Dify endpoints instead."}), 200


@app.route('/api/dify/country-report', methods=['POST'])
def generate_country_report():
    """
    生成国别研究报告
    前端传入:
    - country: 国家代码（如 egypt, algeria 等）
    - report_type: 报告类型（situation: 国别情况报告, quarterly: 季度研究报告）
    - user: Dify用户标识
    """
    try:
        # 获取请求数据
        data = request.get_json()

        country = data.get('country', 'egypt')
        report_type = data.get('report_type', 'situation')
        user = data.get('user', 'default')
        reference_files = data.get('reference_files', [])  # 获取参考文件ID列表

        write_log(f"\n{'='*60}")
        write_log(f"国别报告请求: country={country}, type={report_type}")
        write_log(f"参考文件数量: {len(reference_files)}")

        # 国家名称映射
        country_names = {
            'egypt': '埃及',
            'algeria': '阿尔及利亚',
            'angola': '安哥拉',
            'benin': '贝宁',
            'botswana': '博茨瓦纳',
            'cameroon': '喀麦隆',
            'chad': '乍得',
            'congo': '刚果（布）',
            'drc': '刚果（金）',
            'ethiopia': '埃塞俄比亚',
            'gabon': '加蓬',
            'ghana': '加纳',
            'guinea': '几内亚',
            'kenya': '肯尼亚',
            'libya': '利比亚',
            'madagascar': '马达加斯加',
            'mali': '马里',
            'morocco': '摩洛哥',
            'mozambique': '莫桑比克',
            'namibia': '纳米比亚',
            'nigeria': '尼日利亚',
            'rwanda': '卢旺达',
            'senegal': '塞内加尔',
            'south_africa': '南非',
            'sudan': '苏丹',
            'tanzania': '坦桑尼亚',
            'tunisia': '突尼斯',
            'uganda': '乌干达',
            'zambia': '赞比亚',
            'zimbabwe': '津巴布韦',
        }

        country_name = country_names.get(country, country)

        # 构建工作流输入，传递必要的参数给Dify工作流
        workflow_inputs = {
            "Country": country,  # 国家代码
            "Report_Type": report_type,  # 报告类型
            "Inflation_Rate": "https://zh.tradingeconomics.com/egypt/gdp-growth-annual",
            "Unemployment_Rate": "https://zh.tradingeconomics.com/egypt/government-debt-to-gdp",
            "Stock_Market": "https://zh.tradingeconomics.com/egypt/government-budget",
            "Currency": "https://zh.tradingeconomics.com/egypt/inflation-cpi",
            "Bond_Yield": "https://zh.tradingeconomics.com/egypt/unemployment-rate",
            "CAPMAS": "https://zh.tradingeconomics.com/egypt/exports",
            "Central_Bank_of_Egypt": "https://zh.tradingeconomics.com/egypt/stock-market",
            "Ministry_of_Finance": "https://zh.tradingeconomics.com/egypt/currency",
            "Sigma_Capital": "https://cn.investing.com/rates-bonds/egypt-10-year-bond-yield-historical-data",
            "AP_News": "https://mof.gov.eg/en/archive/monthlyFinancialReport/general/Monthly%20Finance%20Report",
            "El_Balad_News": "https://www.cbe.org.eg/en/news-publications/news/2025/10/02/14/43/mpc-press-release-2-october-2025",
            "SIS": "https://sis.gov.eg/zh/%E5%AA%92%E4%BD%93%E4%B8%AD%E5%BF%83/%E6%96%B0%E9%97%BB/%E8%A7%84%E5%88%92%E9%83%A8%E9%95%BF%E4%BB%8B%E7%BB%8D2024-2025%E8%B4%A2%E5%B9%B4%E5%9F%83%E5%8F%8A%E7%BB%8F%E6%B5%8E%E8%A1%A8%E7%8E%B0%E6%8C%87%E6%A0%87/",
            "SIS2": "https://sis.gov.eg/en/media-center/news/egypt-trade-deficit-narrows-by-46-in-august/",
            "MONEY": "https://www.cbe.org.eg/en/monetary-policy",
            "PDF": "https://www.cbe.org.eg/-/media/project/cbe/listing/publication/monetary-policy-report/2025/monetary-policy-report---q3-2025.pdf",
            "IMF": "https://www.imf.org/en/news/articles/2025/03/11/pr-2558-egypt-imf-completes-4th-rev-eff-arrangement-under-rsf-concl-2025-art-iv-consult",
            "Daily_News_Egypt": "https://www.dailynewsegypt.com/2025/11/09/egypts-net-international-reserves-surpass-50bn-for-first-time-in-october-cbe/",
            "REPORT": "https://www.xinhuanet.com/globe/2024-05/02/c_1310773186.htm",
            "COUNTRY": "https://www.mfa.gov.cn/web/gjhdq_676201/gj_676203/fz_677316/1206_677342/1206x0_677344/",
            "CHINA": "https://www.mfa.gov.cn/web/gjhdq_676201/gj_676203/fz_677316/1206_677342/sbgx_677346/"
        }

        # 如果有参考文件，添加到工作流输入中（只支持一个参考文件）
        if reference_files:
            ref_file_id = reference_files[0]  # 只取第一个参考文件
            workflow_inputs["conference_file"] = {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": ref_file_id
            }
            write_log(f"已添加参考文件 conference_file 到工作流输入")

        # 使用国别报告专用的API Key
        client = DifyAPIClient(COUNTRY_REPORT_API_KEY, DIFY_BASE_URL)

        # 使用流式响应避免网关超时
        write_log("使用流式响应模式...")
        workflow_url = f"{client.base_url}/workflows/run"
        request_data = {
            "inputs": workflow_inputs,
            "response_mode": "streaming",
            "user": user
        }

        response = requests.post(workflow_url, headers=client.headers,
                                   json=request_data,
                                   stream=True,
                                   timeout=WORKFLOW_TIMEOUT)

        if response.status_code != 200:
            write_log(f"工作流启动失败: {response.status_code}")
            write_log(f"错误信息: {response.text}")
            return jsonify({"error": "Failed to start workflow"}), 500

        # 收集流式响应
        outputs = []
        workflow_status = None
        all_data = []

        write_log("开始接收流式数据...")
        last_data_time = time.time()
        timeout_seconds = 1800  # 30分钟超时
        done_received = False

        for line in response.iter_lines():
            # 解码字节为字符串
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            line = line.strip()

            # 检查是否超时
            if time.time() - last_data_time > timeout_seconds:
                write_log(f"  接收数据超时，最后数据时间: {last_data_time}")
                break

            if line.startswith('data:'):
                # 解析数据行
                try:
                    data = json.loads(line[5:])
                    all_data.append(data)
                    last_data_time = time.time()
                    write_log(f"收到数据: {json.dumps(data, ensure_ascii=False)}")

                    # 检查工作流状态
                    if 'status' in data:
                        workflow_status = data['status']
                        write_log(f"工作流状态: {workflow_status}")

                    # 收集输出（只收集 node_finished 事件的输出）
                    if 'event' in data and data['event'] == 'node_finished':
                        if 'data' in data and 'outputs' in data['data']:
                            current_outputs = data['data']['outputs']
                            # 将新输出添加到列表中
                            if isinstance(current_outputs, dict):
                                # 如果是字典，添加所有值
                                for key, value in current_outputs.items():
                                    outputs.append(value)
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
                                # 如果是列表，添加所有元素
                                for output in current_outputs:
                                    outputs.append(output)
                                write_log(f"收到输出(列表): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 内容: {json.dumps(current_outputs, ensure_ascii=False)}")

                except json.JSONDecodeError as e:
                    write_log(f"解析数据行失败: {e}, 行内容: {line}")

            elif line == '[DONE]':
                write_log("工作流完成")
                done_received = True
                break

        write_log(f"最终状态: {workflow_status}")
        write_log(f"最终输出: {len(outputs)} 个")
        write_log(f"所有数据: {len(all_data)} 条")
        write_log(f"是否收到DONE: {done_received}")

        # 返回最终结果
        # 检查工作流是否成功（支持多种状态值）
        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")

        # 如果工作流还在运行中，但有输出，也认为是成功
        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            # 使用最后一个输出
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")

            # 如果输出是字符串，说明是文本输出
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                report_content = output
            else:
                write_log(f"输出类型: {output.get('type')}")
                write_log(f"输出数据: {output.get('data')}")
                write_log(f"输出完整对象: {json.dumps(output, ensure_ascii=False)}")

                # 支持多种输出类型
                report_content = ''
                if output.get('type') == 'document':
                    report_content = output.get('data', '')
                    write_log(f"文档类型输出，URL: {report_content}")
                elif output.get('type') == 'text':
                    report_content = output.get('data', '')
                    write_log(f"文本类型输出，内容: {report_content}")
                elif 'data' in output:
                    report_content = output.get('data', '')
                    write_log(f"通用数据输出，内容: {report_content}")
                else:
                    write_log(f"未知输出类型，输出对象: {output}")

            if report_content:
                write_log(f"✓ 返回成功，报告内容长度: {len(report_content)}")
                return jsonify({
                    "success": True,
                    "report_content": report_content,
                    "country": country,
                    "report_type": report_type
                })
            else:
                write_log(f"✗ 报告内容为空，输出数据: {output}")

        # 如果没有输出，尝试从所有数据中查找最后的输出
        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")

                    report_content = ''
                    if output.get('type') == 'document':
                        report_content = output.get('data', '')
                    elif output.get('type') == 'text':
                        report_content = output.get('data', '')
                    elif 'data' in output:
                        report_content = output.get('data', '')

                    if report_content:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，报告内容长度: {len(report_content)}")
                        return jsonify({
                            "success": True,
                            "report_content": report_content,
                            "country": country,
                            "report_type": report_type
                        })
                    break

        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Workflow failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"生成报告超时")
        return jsonify({"error": "Report generation timeout"}), 500
    except Exception as e:
        write_log(f"生成报告异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/quarterly-report', methods=['POST'])
def generate_quarterly_report():
    """
    生成季度研究报告
    前端传入:
    - country: 国家代码（如 egypt, algeria 等）
    - user: Dify用户标识
    """
    try:
        # 获取请求数据
        data = request.get_json()

        country = data.get('country', 'egypt')
        user = data.get('user', 'default')
        reference_files = data.get('reference_files', [])  # 获取参考文件ID列表

        write_log(f"\n{'='*60}")
        write_log(f"季度报告请求: country={country}")
        write_log(f"参考文件数量: {len(reference_files)}")

        # 国家名称映射
        country_names = {
            'egypt': '埃及',
            'algeria': '阿尔及利亚',
            'angola': '安哥拉',
            'benin': '贝宁',
            'botswana': '博茨瓦纳',
            'cameroon': '喀麦隆',
            'chad': '乍得',
            'congo': '刚果（布）',
            'drc': '刚果（金）',
            'ethiopia': '埃塞俄比亚',
            'gabon': '加蓬',
            'ghana': '加纳',
            'guinea': '几内亚',
            'kenya': '肯尼亚',
            'libya': '利比亚',
            'madagascar': '马达加斯加',
            'mali': '马里',
            'morocco': '摩洛哥',
            'mozambique': '莫桑比克',
            'namibia': '纳米比亚',
            'nigeria': '尼日利亚',
            'rwanda': '卢旺达',
            'senegal': '塞内加尔',
            'south_africa': '南非',
            'sudan': '苏丹',
            'tanzania': '坦桑尼亚',
            'tunisia': '突尼斯',
            'uganda': '乌干达',
            'zambia': '赞比亚',
            'zimbabwe': '津巴布韦',
        }

        country_name = country_names.get(country, country)

        # 构建工作流输入，传递必要的参数给Dify工作流
        workflow_inputs = {
            "Inflation_Rate": "https://zh.tradingeconomics.com/egypt/inflation-cpi",
            "Unemployment_Rate": "https://zh.tradingeconomics.com/egypt/unemployment-rate",
            "Stock_Market": "https://zh.tradingeconomics.com/egypt/stock-market",
            "Currency": "https://zh.tradingeconomics.com/egypt/currency",
            "Bond_Yield": "https://cn.investing.com/rates-bonds/egypt-10-year-bond-yield-historical-data",
            "CAPMAS": "https://www.capmas.gov.eg/publications/22",
            "Central_Bank_of_Egypt": "https://www.cbe.org.eg/en/news-publications/news/2025/11/09/08/06/net-international-reserves-at-the-end-of-october-2025",
            "Ministry_of_Finance": "https://mof.gov.eg/ar/posts/media/",
            "Sigma_Capital": "https://sigmacapital.com.eg/main/news_page_exact?u_sess=%27&newsType=MIST&newsId=45755872",
            "AP_News": "https://apnews.com/article/egypt-fuel-prices-economy-inflation-diesel-gas-e001493d45c58389cbbe82899a37d74f",
            "El_Balad_News": "https://www.elbalad.news/#google_vignette"
        }

        # 如果有参考文件，添加到工作流输入中（只支持一个参考文件）
        if reference_files:
            ref_file_id = reference_files[0]  # 只取第一个参考文件
            workflow_inputs["conference_file"] = {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": ref_file_id
            }
            write_log(f"已添加参考文件 conference_file 到工作流输入")

        # 使用季度报告专用的API Key
        client = DifyAPIClient(QUARTERLY_REPORT_API_KEY, DIFY_BASE_URL)

        # 使用流式响应避免网关超时
        write_log("使用流式响应模式...")
        workflow_url = f"{client.base_url}/workflows/run"
        request_data = {
            "inputs": workflow_inputs,
            "response_mode": "streaming",
            "user": user
        }

        response = requests.post(workflow_url, headers=client.headers,
                                   json=request_data,
                                   stream=True,
                                   timeout=WORKFLOW_TIMEOUT)

        if response.status_code != 200:
            write_log(f"工作流启动失败: {response.status_code}")
            write_log(f"错误信息: {response.text}")
            return jsonify({"error": "Failed to start workflow"}), 500

        # 收集流式响应
        outputs = []
        workflow_status = None
        all_data = []

        write_log("开始接收流式数据...")
        last_data_time = time.time()
        timeout_seconds = 1800  # 30分钟超时
        done_received = False

        for line in response.iter_lines():
            # 解码字节为字符串
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            line = line.strip()

            # 检查是否超时
            if time.time() - last_data_time > timeout_seconds:
                write_log(f"  接收数据超时，最后数据时间: {last_data_time}")
                break

            if line.startswith('data:'):
                # 解析数据行
                try:
                    data = json.loads(line[5:])
                    all_data.append(data)
                    last_data_time = time.time()
                    write_log(f"收到数据: {json.dumps(data, ensure_ascii=False)}")

                    # 检查工作流状态
                    if 'status' in data:
                        workflow_status = data['status']
                        write_log(f"工作流状态: {workflow_status}")

                    # 收集输出（只收集 node_finished 事件的输出）
                    if 'event' in data and data['event'] == 'node_finished':
                        if 'data' in data and 'outputs' in data['data']:
                            current_outputs = data['data']['outputs']
                            # 将新输出添加到列表中
                            if isinstance(current_outputs, dict):
                                # 如果是字典，添加所有值
                                for key, value in current_outputs.items():
                                    outputs.append(value)
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
                                # 如果是列表，添加所有元素
                                for output in current_outputs:
                                    outputs.append(output)
                                write_log(f"收到输出(列表): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 内容: {json.dumps(current_outputs, ensure_ascii=False)}")

                except json.JSONDecodeError as e:
                    write_log(f"解析数据行失败: {e}, 行内容: {line}")

            elif line == '[DONE]':
                write_log("工作流完成")
                done_received = True
                break

        write_log(f"最终状态: {workflow_status}")
        write_log(f"最终输出: {len(outputs)} 个")
        write_log(f"所有数据: {len(all_data)} 条")
        write_log(f"是否收到DONE: {done_received}")

        # 返回最终结果
        # 检查工作流是否成功（支持多种状态值）
        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")

        # 如果工作流还在运行中，但有输出，也认为是成功
        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            # 使用最后一个输出
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")

            # 如果输出是字符串，说明是文本输出
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                report_content = output
            else:
                write_log(f"输出类型: {output.get('type')}")
                write_log(f"输出数据: {output.get('data')}")
                write_log(f"输出完整对象: {json.dumps(output, ensure_ascii=False)}")

                # 支持多种输出类型
                report_content = ''
                if output.get('type') == 'document':
                    report_content = output.get('data', '')
                    write_log(f"文档类型输出，URL: {report_content}")
                elif output.get('type') == 'text':
                    report_content = output.get('data', '')
                    write_log(f"文本类型输出，内容: {report_content}")
                elif 'data' in output:
                    report_content = output.get('data', '')
                    write_log(f"通用数据输出，内容: {report_content}")
                else:
                    write_log(f"未知输出类型，输出对象: {output}")

            if report_content:
                write_log(f"✓ 返回成功，报告内容长度: {len(report_content)}")
                return jsonify({
                    "success": True,
                    "report_content": report_content,
                    "country": country
                })
            else:
                write_log(f"✗ 报告内容为空，输出数据: {output}")

        # 如果没有输出，尝试从所有数据中查找最后的输出
        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")

                    report_content = ''
                    if output.get('type') == 'document':
                        report_content = output.get('data', '')
                    elif output.get('type') == 'text':
                        report_content = output.get('data', '')
                    elif 'data' in output:
                        report_content = output.get('data', '')

                    if report_content:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，报告内容长度: {len(report_content)}")
                        return jsonify({
                            "success": True,
                            "report_content": report_content,
                            "country": country
                        })
                    break

        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Workflow failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"生成报告超时")
        return jsonify({"error": "Report generation timeout"}), 500
    except Exception as e:
        write_log(f"生成报告异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/translate-document', methods=['POST'])
def translate_document():
    """
    文档翻译接口
    前端传入:
    - file_id: 上传文件后返回的ID
    - user: Dify用户标识
    """
    try:
        data = request.get_json()
        file_id = data.get('file_id')
        user = data.get('user', 'default')

        if not file_id:
            return jsonify({"error": "file_id is required"}), 400

        write_log(f"\n{'='*60}")
        write_log(f"文档翻译请求: file_id={file_id}")

        workflow_inputs = {
            "wenjian": {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": file_id
            }
        }

        client = DifyAPIClient(TRANSLATE_API_KEY, DIFY_BASE_URL)
        
        write_log("使用流式响应模式...")
        workflow_url = f"{client.base_url}/workflows/run"
        request_data = {
            "inputs": workflow_inputs,
            "response_mode": "streaming",
            "user": user
        }

        response = requests.post(workflow_url, headers=client.headers,
                                   json=request_data,
                                   stream=True,
                                   timeout=WORKFLOW_TIMEOUT)

        if response.status_code != 200:
            write_log(f"工作流启动失败: {response.status_code}")
            write_log(f"错误信息: {response.text}")
            return jsonify({"error": "Failed to start workflow"}), 500

        outputs = []
        workflow_status = None
        all_data = []
        
        write_log("开始接收流式数据...")
        last_data_time = time.time()
        timeout_seconds = 1800
        done_received = False
        
        for line in response.iter_lines():
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            line = line.strip()
            
            if time.time() - last_data_time > timeout_seconds:
                write_log(f"  接收数据超时，最后数据时间: {last_data_time}")
                break
            
            if line.startswith('data:'):
                try:
                    data = json.loads(line[5:])
                    all_data.append(data)
                    last_data_time = time.time()
                    write_log(f"收到数据: {json.dumps(data, ensure_ascii=False)}")
                    
                    if 'status' in data:
                        workflow_status = data['status']
                        write_log(f"工作流状态: {workflow_status}")
                    
                    if 'event' in data and data['event'] == 'node_finished':
                        if 'data' in data and 'outputs' in data['data']:
                            current_outputs = data['data']['outputs']
                            if isinstance(current_outputs, dict):
                                for key, value in current_outputs.items():
                                    outputs.append(value)
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个")
                            else:
                                for output in current_outputs:
                                    outputs.append(output)
                                write_log(f"收到输出(列表): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个")
                    
                except json.JSONDecodeError as e:
                    write_log(f"解析数据行失败: {e}, 行内容: {line}")
            
            elif line == '[DONE]':
                write_log("工作流完成")
                done_received = True
                break
        
        write_log(f"最终状态: {workflow_status}")
        write_log(f"最终输出: {len(outputs)} 个")
        write_log(f"所有数据: {len(all_data)} 条")
        write_log(f"是否收到DONE: {done_received}")
        
        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")
        
        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")
            
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                translated_content = output
            else:
                write_log(f"输出类型: {output.get('type')}")
                write_log(f"输出数据: {output.get('data')}")
                
                translated_content = ''
                if output.get('type') == 'document':
                    translated_content = output.get('data', '')
                    write_log(f"文档类型输出，URL: {translated_content}")
                elif output.get('type') == 'text':
                    translated_content = output.get('data', '')
                    write_log(f"文本类型输出，内容: {translated_content}")
                elif 'data' in output:
                    translated_content = output.get('data', '')
                    write_log(f"通用数据输出，内容: {translated_content}")
                else:
                    write_log(f"未知输出类型，输出对象: {output}")
            
            if translated_content:
                write_log(f"✓ 返回成功，翻译内容长度: {len(translated_content)}")
                return jsonify({
                    "success": True,
                    "translated_content": translated_content
                })
            else:
                write_log(f"✗ 翻译内容为空，输出数据: {output}")
        
        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")
                    
                    translated_content = ''
                    if output.get('type') == 'document':
                        translated_content = output.get('data', '')
                    elif output.get('type') == 'text':
                        translated_content = output.get('data', '')
                    elif 'data' in output:
                        translated_content = output.get('data', '')
                    
                    if translated_content:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，翻译内容长度: {len(translated_content)}")
                        return jsonify({
                            "success": True,
                            "translated_content": translated_content
                        })
                    break
        
        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Workflow failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"翻译超时")
        return jsonify({"error": "Translation timeout"}), 500
    except Exception as e:
        write_log(f"翻译异常: {e}")
        return jsonify({"error": str(e)}), 500


# ============= 反馈API路由 =============

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """提交反馈（支持 Supabase 和 JSON 文件）"""
    try:
        data = request.get_json()

        # 验证必需字段
        if not data.get('content'):
            return jsonify({"error": "反馈内容不能为空"}), 400

        # 如果启用了 Supabase，优先使用
        if SUPABASE_ENABLED:
            user_id = data.get('user_id', 'default')
            feedback_type = data.get('type', 'other')
            content = data.get('content', '').strip()
            contact = data.get('contact')

            write_log(f"提交反馈到 Supabase: type={feedback_type}")

            feedback_id = db.create_feedback(user_id, feedback_type, content, contact)

            if feedback_id:
                return jsonify({
                    "success": True,
                    "message": "反馈提交成功",
                    "feedback_id": feedback_id
                }), 200
            else:
                return jsonify({"error": "提交失败"}), 500

        # 否则使用 JSON 文件存储（备用）
        feedback = {
            "id": f"feedback_{datetime.now().strftime('%Y%m%d%H%M%S_%f')}",
            "type": data.get('type', 'other'),
            "content": data.get('content', '').strip(),
            "contact": data.get('contact', ''),
            "timestamp": data.get('timestamp', datetime.now().isoformat()),
            "status": "pending",  # pending, reviewed, resolved
            "created_at": datetime.now().isoformat()
        }

        # 保存反馈
        if save_feedback(feedback):
            return jsonify({
                "success": True,
                "message": "反馈提交成功",
                "feedback_id": feedback["id"]
            }), 200
        else:
            return jsonify({"error": "保存反馈失败"}), 500

    except Exception as e:
        write_log(f"提交反馈异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedback', methods=['GET'])
def get_feedbacks():
    """
    获取所有反馈（管理员接口）
    可选参数：
    - status: 过滤状态 (pending, reviewed, resolved)
    - type: 过滤类型 (issue, suggestion, other)
    - limit: 限制返回数量
    """
    try:
        # 获取查询参数
        status_filter = request.args.get('status')
        type_filter = request.args.get('type')
        limit = request.args.get('limit', type=int)

        # 加载所有反馈
        feedbacks = load_feedbacks()

        # 过滤
        if status_filter:
            feedbacks = [f for f in feedbacks if f.get('status') == status_filter]

        if type_filter:
            feedbacks = [f for f in feedbacks if f.get('type') == type_filter]

        # 按时间倒序排序
        feedbacks.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # 限制数量
        if limit and limit > 0:
            feedbacks = feedbacks[:limit]

        # 格式化返回
        formatted_feedbacks = []
        for f in feedbacks:
            formatted_feedbacks.append({
                "id": f.get('id'),
                "type": f.get('type'),
                "type_label": format_feedback_type(f.get('type')),
                "content": f.get('content'),
                "contact": f.get('contact'),
                "timestamp": f.get('timestamp'),
                "status": f.get('status'),
                "created_at": f.get('created_at')
            })

        return jsonify({
            "success": True,
            "count": len(formatted_feedbacks),
            "feedbacks": formatted_feedbacks
        }), 200

    except Exception as e:
        write_log(f"获取反馈异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedback/<feedback_id>', methods=['PATCH'])
def update_feedback_status(feedback_id):
    """
    更新反馈状态（管理员接口）
    参数：
    - status: 新状态 (reviewed, resolved)
    """
    try:
        data = request.get_json()
        new_status = data.get('status')

        if not new_status:
            return jsonify({"error": "状态不能为空"}), 400

        if new_status not in ['pending', 'reviewed', 'resolved']:
            return jsonify({"error": "无效的状态值"}), 400

        # 加载所有反馈
        feedbacks = load_feedbacks()

        # 查找并更新反馈
        updated = False
        for f in feedbacks:
            if f.get('id') == feedback_id:
                f['status'] = new_status
                f['updated_at'] = datetime.now().isoformat()
                updated = True
                break

        if not updated:
            return jsonify({"error": "反馈不存在"}), 404

        # 保存更新后的反馈
        with open(FEEDBACK_FILE, 'w', encoding='utf-8') as f:
            json.dump(feedbacks, f, ensure_ascii=False, indent=2)

        write_log(f"✓ 反馈状态已更新: {feedback_id} -> {new_status}")
        return jsonify({
            "success": True,
            "message": "状态更新成功"
        }), 200

    except Exception as e:
        write_log(f"更新反馈状态异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedback/stats', methods=['GET'])
def get_feedback_stats():
    """
    获取反馈统计信息（管理员接口）
    """
    try:
        feedbacks = load_feedbacks()

        stats = {
            "total": len(feedbacks),
            "by_status": {
                "pending": len([f for f in feedbacks if f.get('status') == 'pending']),
                "reviewed": len([f for f in feedbacks if f.get('status') == 'reviewed']),
                "resolved": len([f for f in feedbacks if f.get('status') == 'resolved'])
            },
            "by_type": {
                "issue": len([f for f in feedbacks if f.get('type') == 'issue']),
                "suggestion": len([f for f in feedbacks if f.get('type') == 'suggestion']),
                "other": len([f for f in feedbacks if f.get('type') == 'other'])
            }
        }

        return jsonify({
            "success": True,
            "stats": stats
        }), 200

    except Exception as e:
        write_log(f"获取统计信息异常: {e}")
        return jsonify({"error": str(e)}), 500


# ============= Supabase 数据库 API =============

@app.route('/api/conversions', methods=['GET'])
def get_conversions():
    """
    获取用户的转换历史记录
    参数：
    - user_id: 用户ID（默认：default）
    - task_type: 任务类型过滤（可选）
    - limit: 返回数量限制（默认：50）
    """
    try:
        if not SUPABASE_ENABLED:
            return jsonify({"error": "Database not enabled"}), 503

        user_id = request.args.get('user_id', 'default')
        task_type = request.args.get('task_type')
        limit = int(request.args.get('limit', 50))

        write_log(f"查询转换历史: user_id={user_id}, task_type={task_type}")

        records = db.get_user_conversion_records(user_id, task_type, limit)

        return jsonify({
            "success": True,
            "count": len(records),
            "records": records
        }), 200

    except Exception as e:
        write_log(f"获取转换历史异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/conversions/<record_id>', methods=['GET'])
def get_conversion_record(record_id):
    """获取单个转换记录详情"""
    try:
        if not SUPABASE_ENABLED:
            return jsonify({"error": "Database not enabled"}), 503

        write_log(f"查询转换记录详情: {record_id}")

        record = db.get_conversion_record(record_id)

        if record:
            return jsonify({
                "success": True,
                "record": record
            }), 200
        else:
            return jsonify({"error": "Record not found"}), 404

    except Exception as e:
        write_log(f"获取转换记录详情异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedbacks/supabase', methods=['GET'])
def get_feedbacks_supabase():
    """
    从 Supabase 获取所有反馈（管理员接口）
    参数：
    - status: 状态过滤（可选）
    - feedback_type: 类型过滤（可选）
    - limit: 返回数量限制（默认：100）
    """
    try:
        if not SUPABASE_ENABLED:
            return jsonify({"error": "Database not enabled"}), 503

        status = request.args.get('status')
        feedback_type = request.args.get('feedback_type')
        limit = int(request.args.get('limit', 100))

        write_log(f"查询反馈列表: status={status}, type={feedback_type}")

        feedbacks = db.get_all_feedbacks(status, feedback_type, limit)

        return jsonify({
            "success": True,
            "count": len(feedbacks),
            "feedbacks": feedbacks
        }), 200

    except Exception as e:
        write_log(f"获取反馈列表异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedbacks/supabase/<feedback_id>', methods=['PATCH'])
def update_feedback_supabase(feedback_id):
    """
    更新反馈状态（管理员接口，使用 Supabase）
    参数：
    - status: 新状态 (reviewed, resolved)
    - admin_reply: 管理员回复（可选）
    """
    try:
        if not SUPABASE_ENABLED:
            return jsonify({"error": "Database not enabled"}), 503

        data = request.get_json()
        new_status = data.get('status')
        admin_reply = data.get('admin_reply')

        if not new_status:
            return jsonify({"error": "status is required"}), 400

        write_log(f"更新反馈状态: {feedback_id} -> {new_status}")

        success = db.update_feedback_status(feedback_id, new_status, admin_reply)

        if success:
            return jsonify({
                "success": True,
                "message": "状态更新成功"
            }), 200
        else:
            return jsonify({"error": "Update failed"}), 500

    except Exception as e:
        write_log(f"更新反馈状态异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/feedbacks/supabase/stats', methods=['GET'])
def get_feedback_stats_supabase():
    """获取反馈统计信息（管理员接口，使用 Supabase）"""
    try:
        if not SUPABASE_ENABLED:
            return jsonify({"error": "Database not enabled"}), 503

        write_log("查询反馈统计信息")

        stats = db.get_feedback_stats()

        return jsonify({
            "success": True,
            "stats": stats
        }), 200

    except Exception as e:
        write_log(f"获取反馈统计异常: {e}")
        return jsonify({"error": str(e)}), 500


# ======================================

def main():
    """启动 Flask 服务器"""
    print("=" * 60)
    print("Dify API Backend Server")
    print("=" * 60)
    print(f"App ID: {APP_ID}")
    print(f"Server running at: http://127.0.0.1:{BACKEND_PORT}")
    print("=" * 60)
    print("\n可用接口:")
    print("  - GET  /health - 健康检查")
    print("  - POST /api/dify/upload - 上传文档")
    print("  - POST /api/dify/convert - 转公文")
    print("  - POST /api/dify/country-report - 生成国别情况报告")
    print("  - POST /api/dify/quarterly-report - 生成季度研究报告")
    print("  - POST /api/dify/translate-document - 文档翻译")
    print("  - POST /api/translate-image - 图片翻译")
    print("")
    print("  - POST /api/feedback - 提交反馈")
    print("  - GET  /api/feedback - 获取所有反馈（JSON文件）")
    print("  - GET  /api/feedback/stats - 获取反馈统计（JSON文件）")
    print("  - PATCH /api/feedback/<id> - 更新反馈状态（JSON文件）")
    print("")
    print("  - GET  /api/conversions - 获取转换历史（Supabase）")
    print("  - GET  /api/conversions/<id> - 获取转换记录详情（Supabase）")
    print("  - GET  /api/feedbacks/supabase - 获取所有反馈（Supabase）")
    print("  - GET  /api/feedbacks/supabase/stats - 获取反馈统计（Supabase）")
    print("  - PATCH /api/feedbacks/supabase/<id> - 更新反馈状态（Supabase）")
    print("=" * 60)

    if SUPABASE_ENABLED:
        print("\n[OK] Supabase database enabled")
    else:
        print("\n[WARN] Supabase not configured, using file storage")

    app.run(host='127.0.0.1', port=BACKEND_PORT, debug=True)


if __name__ == '__main__':
    main()
