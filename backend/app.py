import os
import requests
import json
import time
from flask import Flask, request, jsonify, Response, stream_with_context, send_file
from flask_cors import CORS
from typing import Optional, Generator
from datetime import datetime
from PIL import Image
from openai import OpenAI
import io
import base64
import re

# ============= 配置区域 =============
# Dify API Keys
ACADEMIC_TO_OFFICIAL_API_KEY = "app-yVGdpuEwALJTY7CeSkxuNpDo"
COUNTRY_SITUATION_API_KEY = "app-IWiuVAJEEBP8zoDUOME7XKKG"
QUARTERLY_REPORT_API_KEY = "app-IzeCySdSIPnMPXGakcgZU4Ry"
TRANSLATE_API_KEY = "app-nWremBnU8z7Dq4fm6RXGU2fp"
DIFY_BASE_URL = "https://api.dify.ai/v1"

# OpenAI API Key（用于图片翻译）
OPENAI_API_KEY = "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"
OPENAI_API_URL = "https://openrouter.ai/api/v1"
OPENAI_MODEL_NAME = "google/gemini-3-pro-image-preview"

# 应用配置
APP_ID = "Dify"
BACKEND_PORT = 5000

# 处理参数
UPLOAD_TIMEOUT = 120
WORKFLOW_TIMEOUT = 1800
MAX_IMAGE_SIZE = 1600
JPEG_QUALITY = 85
MAX_RETRIES = 5
RETRY_DELAY = 10
DOWNLOAD_TIMEOUT = 180

# 图片翻译提示词
IMAGE_TRANSLATION_PROMPT = "帮我生成图片：请检查图中的所有英文，包括竖写和横写，并将英文翻译为简体中文，其余元素保持不变。原比例。"

# 日志配置
LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "conversion.log")

# 确保日志目录存在
os.makedirs(LOG_DIR, exist_ok=True)

def write_log(message):
    """写入日志文件"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}\n"
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_entry)
    print(message)


app = Flask(__name__)
CORS(app)


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
        """上传文件到Dify的存储服务"""
        upload_url = f"{self.base_url}/files/upload"

        mime_types = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'rtf': 'application/rtf'
        }

        try:
            if hasattr(file, 'filename'):
                filename = file.filename
                file.seek(0)
                ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
                mime_type = mime_types.get(ext, 'application/octet-stream')
                files = {'file': (filename, file, mime_type)}
            else:
                filename = os.path.basename(file)
                ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
                mime_type = mime_types.get(ext, 'application/octet-stream')
                files = {'file': (filename, open(file, 'rb'), mime_type)}

            data = {'user': user}

            write_log(f"上传文件到Dify: {filename}, MIME类型: {mime_type}")
            response = requests.post(upload_url, headers={'Authorization': f'Bearer {self.api_key}'},
                                       files=files, data=data, timeout=UPLOAD_TIMEOUT)

            if response.status_code in [200, 201]:
                result = response.json()
                write_log(f"文件上传成功: {result.get('name')}, ID: {result.get('id')}")
                return result.get('id')
            else:
                write_log(f"文件上传失败: {response.status_code}")
                write_log(f"错误信息: {response.text}")
                return None

        except requests.exceptions.Timeout:
            write_log(f"文件上传超时")
            return None
        except Exception as e:
            write_log(f"文件上传异常: {e}")
            return None

    def run_workflow_blocking(self, workflow_inputs, user="", max_retries=3):
        """执行工作流（阻塔回复模式）"""
        workflow_url = f"{self.base_url}/workflows/run"

        data = {
            "inputs": workflow_inputs,
            "response_mode": "blocking",
            "user": user
        }

        print(f"执行工作流（阻塔回复模式）")
        print(f"输入参数: {json.dumps(workflow_inputs, ensure_ascii=False, indent=2)}")

        for attempt in range(max_retries):
            try:
                print(f"尝试 {attempt + 1}/{max_retries}...")
                response = requests.post(workflow_url, headers=self.headers,
                                           json=data, timeout=WORKFLOW_TIMEOUT)

                if response.status_code == 200:
                    result = response.json()
                    print(f"工作流执行成功")
                    if 'data' in result:
                        return result['data']
                    return None
                elif response.status_code == 504:
                    print(f"网关超时（504），准备重试...")
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 30
                        print(f"等待 {wait_time} 秒后重试...")
                        time.sleep(wait_time)
                    continue
                else:
                    print(f"工作流执行失败: {response.status_code}")
                    print(f"错误信息: {response.text}")
                    return None
            except requests.exceptions.Timeout:
                print(f"工作流执行超时")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 30
                    print(f"等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                    continue
                return None
            except Exception as e:
                print(f"工作流执行异常: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 30
                    print(f"等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                    continue
                return None

        print(f"已达到最大重试次数 {max_retries}，放弃")
        return None

    def run_workflow_streaming(self, workflow_inputs, user=""):
        """执行工作流（流式响应）"""
        workflow_url = f"{self.base_url}/workflows/run"

        data = {
            "inputs": workflow_inputs,
            "response_mode": "streaming",
            "user": user
        }

        print(f"执行工作流（流式响应）")
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
                            data = json.loads(line[5:])
                            print(f"数据: {json.dumps(data, ensure_ascii=False)}")
                            yield data
                        elif line == '[DONE]':
                            print("工作流完成")
                            break
            except requests.exceptions.Timeout:
                print("工作流超时")
                return
            except Exception as e:
                print(f"工作流异常: {e}")
                return

        return Response(generate(), mimetype='text/event-stream')


class OpenAIClient:
    """OpenAI API 客户端类（用于图片翻译）"""

    def __init__(self, api_key, base_url="https://openrouter.ai/api/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = OpenAI(base_url=base_url, api_key=api_key)

    def translate_image(self, image_b64):
        """调用OpenAI API进行图片翻译"""
        for attempt in range(MAX_RETRIES):
            try:
                print(f"API调用尝试 {attempt + 1}/{MAX_RETRIES}...")

                completion = self.client.chat.completions.create(
                    model=OPENAI_MODEL_NAME,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": IMAGE_TRANSLATION_PROMPT},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
                    ]
                }],
                    extra_headers={
                        "HTTP-Referer": "https://pdf.local",
                        "X-Title": "PDF-Image-Extractor"
                    },
                    extra_body={"modalities": ["image"]},
                    timeout=300
                )

                print("API调用成功!")
                return completion

            except Exception as e:
                print(f"API错误 (尝试 {attempt + 1}): {e}")

                if attempt < MAX_RETRIES - 1:
                    wait_time = RETRY_DELAY * (attempt + 1)
                    print(f"等待 {wait_time}s 后重试...")
                    time.sleep(wait_time)
                else:
                    print(f"所有 {MAX_RETRIES} 次尝试失败")
                    raise

    def extract_image_from_completion(self, completion):
        """从API响应中提取图片"""
        items = []
        seen = set()

        def add_http(url):
            u = url.strip()
            if u.endswith((")", "]", "}", ",")):
                u = u.rstrip(")]},")
            key = ("http", u)
            if key not in seen:
                seen.add(key)
                items.append({"type": "http", "url": u, "fmt": None, "b64": None})

        def add_data(fmt, b64):
            key = ("data", fmt, b64)
            if key not in seen:
                seen.add(key)
                items.append({"type": "data", "url": None, "fmt": fmt.lower(), "b64": b64})

        def add_from_str(s):
            for m in re.findall(r"https?://\S+", s):
                add_http(m)
            for m in re.findall(r"!\[[^\]]*\]\((https?://[^\)]+)\)", s):
                add_http(m)
            for m in re.findall(r"data:image/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)", s):
                add_data(m[0], m[1])

        def walk(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    if isinstance(v, str):
                        if k.lower() in ("url", "image_url"):
                            if v.startswith("http") or v.startswith("data:image"):
                                add_from_str(v)
                        add_from_str(v)
                    elif isinstance(v, dict):
                        if "url" in v and isinstance(v["url"], str):
                            add_from_str(v["url"])
                    walk(v)
            elif isinstance(x, list):
                for v in x:
                    walk(v)
            elif isinstance(x, str):
                add_from_str(x)

        if hasattr(completion, "model_dump"):
            obj = completion.model_dump()
        elif hasattr(completion, "__dict__"):
            obj = completion.__dict__
        else:
            obj = {"raw": str(completion)}

        walk(obj)
        return items

    def get_image_from_response(self, completion):
        """从API响应中获取图片"""
        all_items = self.extract_image_from_completion(completion)
        if not all_items:
            raise Exception("No image found in response")

        image_item = all_items[0]

        if image_item["type"] == "http":
            r = requests.get(image_item["url"], timeout=DOWNLOAD_TIMEOUT)
            r.raise_for_status()
            return r.content, ".jpg"
        else:
            fmt = image_item["fmt"]
            b64 = image_item["b64"]
            ext = ".jpg" if fmt in ("jpeg", "jpg") else ".png"
            return base64.b64decode(b64), ext


def init_dify_client():
    """初始化Dify API客户端（学术报告转公文）"""
    return DifyAPIClient(ACADEMIC_TO_OFFICIAL_API_KEY, DIFY_BASE_URL)


def init_openai_client():
    """初始化OpenAI API客户端（图片翻译）"""
    return OpenAIClient(OPENAI_API_KEY, OPENAI_API_URL)


def load_and_preprocess_image(image_file):
    """加载并预处理图片"""
    try:
        im = Image.open(image_file).convert("RGB")
        w, h = im.size

        m = max(w, h)
        if m > MAX_IMAGE_SIZE:
            scale = MAX_IMAGE_SIZE / float(m)
            new_w, new_h = int(w * scale), int(h * scale)
            im = im.resize((new_w, new_h), Image.LANCZOS)
            print(f"Resized: {w}x{h} -> {new_w}x{new_h}")

        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return b64, (w, h)
    except Exception as e:
        print(f"Error processing image: {e}")
        raise


# ============= API 路由 ============

@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({"status": "ok", "message": "Dify API Server is running", "app_id": APP_ID})


@app.route('/api/dify/upload', methods=['POST'])
def upload_document():
    """上传文档到Dify"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    user = request.form.get('user', 'default')

    if not file:
        return jsonify({"error": "No file selected"}), 400

    print(f"\n上传文档: {file.filename}, 用户: {user}")

    allowed_extensions = {'pdf', 'doc', 'docx', 'txt', 'rtf'}
    if '.' in file.filename:
        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext not in allowed_extensions:
            return jsonify({"error": "Invalid file type. Only PDF, DOC, DOCX, TXT, RTF supported"}), 400

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
        print(f"上传异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/convert', methods=['POST'])
def convert_to_official():
    """调用Dify工作流进行学术报告转公文（使用流式响应避免超时）"""
    try:
        data = request.get_json()

        file_id = data.get('file_id')
        user = data.get('user', 'default')
        output_format = data.get('output_format', 'docx')

        if not file_id:
            return jsonify({"error": "file_id is required"}), 400

        write_log(f"\n{'='*60}")
        write_log(f"转公文请求: file_id={file_id}, format={output_format}")

        workflow_inputs = {
            "wenjian": {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": file_id
            }
        }

        client = init_dify_client()
        
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
                write_log(f"接收数据超时，最后数据时间: {last_data_time}")
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
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
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
        
        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")
        
        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")

            output_url = ''
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                output_url = output
            elif isinstance(output, dict):
                write_log(f"输出类型: {output.get('type')}")
                write_log(f"输出数据: {output.get('data')}")
                write_log(f"输出完整对象: {json.dumps(output, ensure_ascii=False)}")

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
            elif isinstance(output, list):
                write_log(f"检测到列表输出，尝试提取第一个元素")
                if len(output) > 0:
                    first_item = output[0]
                    if isinstance(first_item, str):
                        output_url = first_item
                        write_log(f"列表第一个元素是字符串，直接使用: {output_url}")
                    elif isinstance(first_item, dict):
                        if first_item.get('type') == 'document':
                            output_url = first_item.get('data', '')
                            write_log(f"列表第一个元素是文档，URL: {output_url}")
                        elif first_item.get('type') == 'text':
                            output_url = first_item.get('data', '')
                            write_log(f"列表第一个元素是文本，内容: {output_url}")
                        elif 'data' in first_item:
                            output_url = first_item.get('data', '')
                            write_log(f"列表第一个元素通用数据，内容: {output_url}")
                    else:
                        write_log(f"列表第一个元素类型未知: {type(first_item)}")
                else:
                    write_log(f"列表为空，无法提取")
            else:
                write_log(f"未知输出类型: {type(output)}")

            if output_url:
                write_log(f"✓ 返回成功，输出URL: {output_url}")
                return jsonify({
                    "success": True,
                    "output_url": output_url,
                    "filename": f"converted_document.{output_format}"
                })
            else:
                write_log(f"✗ 输出URL为空，输出数据: {output}")
        
        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")

                    output_url = ''
                    if isinstance(output, str):
                        write_log(f"检测到文本输出，直接使用")
                        output_url = output
                    elif isinstance(output, dict):
                        if output.get('type') == 'document':
                            output_url = output.get('data', '')
                            write_log(f"文档类型输出，URL: {output_url}")
                        elif output.get('type') == 'text':
                            output_url = output.get('data', '')
                            write_log(f"文本类型输出，内容: {output_url}")
                        elif 'data' in output:
                            output_url = output.get('data', '')
                            write_log(f"通用数据输出，内容: {output_url}")
                    elif isinstance(output, list):
                        write_log(f"检测到列表输出，尝试提取第一个元素")
                        if len(output) > 0:
                            first_item = output[0]
                            if isinstance(first_item, str):
                                output_url = first_item
                                write_log(f"列表第一个元素是字符串，直接使用: {output_url}")
                            elif isinstance(first_item, dict):
                                if first_item.get('type') == 'document':
                                    output_url = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文档，URL: {output_url}")
                                elif first_item.get('type') == 'text':
                                    output_url = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文本，内容: {output_url}")
                                elif 'data' in first_item:
                                    output_url = first_item.get('data', '')
                                    write_log(f"列表第一个元素通用数据，内容: {output_url}")

                    if output_url:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，输出URL: {output_url}")
                        return jsonify({
                            "success": True,
                            "output_url": output_url,
                            "filename": f"converted_document.{output_format}"
                        })
                    break
        
        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Workflow failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"转换超时")
        return jsonify({"error": "Conversion timeout"}), 500
    except Exception as e:
        write_log(f"转换异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/convert-stream', methods=['POST'])
def convert_to_official_streaming():
    """流式版本的文档转公文接口"""
    try:
        data = request.get_json()

        file_id = data.get('file_id')
        user = data.get('user', 'default')
        output_format = data.get('output_format', 'docx')

        if not file_id:
            return jsonify({"error": "file_id is required"}), 400

        print(f"\n流式转公文: file_id={file_id}")

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
        print(f"流式转换异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/translate-document', methods=['POST'])
def translate_document():
    """文档翻译接口"""
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
                write_log(f"接收数据超时，最后数据时间: {last_data_time}")
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
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
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
        
        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")
        
        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")

            translated_content = ''
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                translated_content = output
            elif isinstance(output, dict):
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
            elif isinstance(output, list):
                write_log(f"检测到列表输出，尝试提取第一个元素")
                if len(output) > 0:
                    first_item = output[0]
                    if isinstance(first_item, str):
                        translated_content = first_item
                        write_log(f"列表第一个元素是字符串，直接使用: {translated_content}")
                    elif isinstance(first_item, dict):
                        if first_item.get('type') == 'document':
                            translated_content = first_item.get('data', '')
                            write_log(f"列表第一个元素是文档，URL: {translated_content}")
                        elif first_item.get('type') == 'text':
                            translated_content = first_item.get('data', '')
                            write_log(f"列表第一个元素是文本，内容: {translated_content}")
                        elif 'data' in first_item:
                            translated_content = first_item.get('data', '')
                            write_log(f"列表第一个元素通用数据，内容: {translated_content}")
                    else:
                        write_log(f"列表第一个元素类型未知: {type(first_item)}")
                else:
                    write_log(f"列表为空，无法提取")
            else:
                write_log(f"未知输出类型: {type(output)}")

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
                    if isinstance(output, str):
                        write_log(f"检测到文本输出，直接使用")
                        translated_content = output
                    elif isinstance(output, dict):
                        if output.get('type') == 'document':
                            translated_content = output.get('data', '')
                            write_log(f"文档类型输出，URL: {translated_content}")
                        elif output.get('type') == 'text':
                            translated_content = output.get('data', '')
                            write_log(f"文本类型输出，内容: {translated_content}")
                        elif 'data' in output:
                            translated_content = output.get('data', '')
                            write_log(f"通用数据输出，内容: {translated_content}")
                    elif isinstance(output, list):
                        write_log(f"检测到列表输出，尝试提取第一个元素")
                        if len(output) > 0:
                            first_item = output[0]
                            if isinstance(first_item, str):
                                translated_content = first_item
                                write_log(f"列表第一个元素是字符串，直接使用: {translated_content}")
                            elif isinstance(first_item, dict):
                                if first_item.get('type') == 'document':
                                    translated_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文档，URL: {translated_content}")
                                elif first_item.get('type') == 'text':
                                    translated_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文本，内容: {translated_content}")
                                elif 'data' in first_item:
                                    translated_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素通用数据，内容: {translated_content}")

                    if translated_content:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，翻译内容长度: {len(translated_content)}")
                        return jsonify({
                            "success": True,
                            "translated_content": translated_content
                        })
                    break
        
        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Translation failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"翻译超时")
        return jsonify({"error": "Translation timeout"}), 500
    except Exception as e:
        write_log(f"翻译异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/country-report', methods=['POST'])
def generate_country_report():
    """生成国别研究报告"""
    try:
        data = request.get_json()

        country = data.get('country', 'egypt')
        report_type = data.get('report_type', 'situation')
        user = data.get('user', 'default')

        write_log(f"\n{'='*60}")
        write_log(f"国别报告请求: country={country}, type={report_type}")

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

        workflow_inputs = {
            "Country": country,
            "Report_Type": report_type,
            "Inflation_Rate": "https://zh.tradingeconomics.com/egypt/gdp-growth-annual",
            "Unemployment_Rate": "https://zh.tradingeconomics.com/egypt/government-debt-to-gdp",
            "Stock_Market": "https://zh.tradingeconomics.com/egypt/government-budget",
            "Currency": "https://zh.tradingeconomics.com/egypt/inflation-cpi",
            "Bond_Yield": "https://cn.investing.com/rates-bonds/egypt-10-year-bond-yield-historical-data",
            "CAPMAS": "https://zh.tradingeconomics.com/egypt/exports",
            "Central_Bank_of_Egypt": "https://zh.tradingeconomics.com/egypt/stock-market",
            "Ministry_of_Finance": "https://zh.tradingeconomics.com/egypt/currency",
            "Sigma_Capital": "https://cn.investing.com/rates-bonds/egypt-10-year-bond-yield-historical-data",
            "AP_News": "https://mof.gov.eg/en/archive/monthlyFinancialReport/general/Monthly%20Finance%20Report",
            "El_Balad_News": "https://www.cbe.org.eg/en/news-publications/news/2025/10/02/14/43/mpc-press-release-2-october-2025",
            "SIS": "https://sis.gov.eg/zh/%E5%AA%92%E4%BD%93%E4%B8%AD%E5%BF%83%E5%8F%8A%E7%BB%8D2024-2025%E8%B4%A2%E5%B9%B4%E5%9F%83%E5%8F%8A%E7%BB%8F%E6%B5%8E%E8%A1%A8%E7%8E%B0%E6%8C%87%E6%A0%87/",
            "SIS2": "https://sis.gov.eg/en/media-center/news/egypt-trade-deficit-narrows-by-46-in-august/",
            "MONEY": "https://www.cbe.org.eg/en/monetary-policy",
            "PDF": "https://www.cbe.org.eg/-/media/project/cbe/listing/publication/monetary-policy-report/2025/monetary-policy-report---q3-2025.pdf",
            "IMF": "https://www.imf.org/en/news/articles/2025/03/11/pr-2558-egypt-imf-completes-4th-rev-eff-arrangement-under-rsf-concl-2025-art-iv-consult",
            "Daily_News_Egypt": "https://www.dailynewsegypt.com/2025/11/09/egypts-net-international-reserves-surpass-50bn-for-first-time-in-october-cbe/",
            "REPORT": "https://www.xinhuanet.com/globe/2024-05/02/c_1310773186.htm",
            "COUNTRY": "https://www.mfa.gov.cn/web/gjhdq_676201/gj_676203/fz_677316/1206_677342/1206x0_677344/sbgx_677346/",
            "CHINA": "https://www.mfa.gov.cn/web/gjhdq_676201/gj_676203/fz_677316/1206_677342/sbgx_677346/"
        }

        client = DifyAPIClient(COUNTRY_SITUATION_API_KEY, DIFY_BASE_URL)

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
                write_log(f"接收数据超时，最后数据时间: {last_data_time}")
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
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
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

        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")

        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")

            report_content = ''
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                report_content = output
            else:
                write_log(f"输出类型: {output.get('type')}")
                write_log(f"输出数据: {output.get('data')}")
                write_log(f"输出完整对象: {json.dumps(output, ensure_ascii=False)}")

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

        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")

                    report_content = ''
                    if isinstance(output, str):
                        write_log(f"检测到文本输出，直接使用")
                        report_content = output
                    elif isinstance(output, dict):
                        if output.get('type') == 'document':
                            report_content = output.get('data', '')
                            write_log(f"文档类型输出，URL: {report_content}")
                        elif output.get('type') == 'text':
                            report_content = output.get('data', '')
                            write_log(f"文本类型输出，内容: {report_content}")
                        elif 'data' in output:
                            report_content = output.get('data', '')
                            write_log(f"通用数据输出，内容: {report_content}")
                    elif isinstance(output, list):
                        write_log(f"检测到列表输出，尝试提取第一个元素")
                        if len(output) > 0:
                            first_item = output[0]
                            if isinstance(first_item, str):
                                report_content = first_item
                                write_log(f"列表第一个元素是字符串，直接使用: {report_content}")
                            elif isinstance(first_item, dict):
                                if first_item.get('type') == 'document':
                                    report_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文档，URL: {report_content}")
                                elif first_item.get('type') == 'text':
                                    report_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文本，内容: {report_content}")
                                elif 'data' in first_item:
                                    report_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素通用数据，内容: {report_content}")

                    if report_content:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，报告内容长度: {len(report_content)}")
                        return jsonify({
                            "success": True,
                            "report_content": report_content,
                            "country": country
                        })
                    break

        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Report generation failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"生成报告超时")
        return jsonify({"error": "Report generation timeout"}), 500
    except Exception as e:
        write_log(f"生成报告异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dify/quarterly-report', methods=['POST'])
def generate_quarterly_report():
    """生成季度研究报告"""
    try:
        data = request.get_json()

        country = data.get('country', 'egypt')
        user = data.get('user', 'default')

        write_log(f"\n{'='*60}")
        write_log(f"季度报告请求: country={country}")

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

        workflow_inputs = {
            "Country": country,
            "Report_Type": "quarterly"
        }

        client = DifyAPIClient(QUARTERLY_REPORT_API_KEY, DIFY_BASE_URL)

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
                write_log(f"接收数据超时，最后数据时间: {last_data_time}")
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
                                write_log(f"收到输出(字典): {len(current_outputs)} 个, 总输出数: {len(outputs)} 个, 键: {list(current_outputs.keys())}")
                            else:
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

        success_statuses = ['succeeded', 'success', 'completed', 'finished', 'running']
        write_log(f"检查状态: {workflow_status} 是否在成功列表中: {workflow_status in success_statuses}")

        if (workflow_status in success_statuses or workflow_status is None) and len(outputs) > 0:
            output = outputs[-1]
            write_log(f"输出类型: {type(output)}")
            write_log(f"输出内容: {output}")

            report_content = ''
            if isinstance(output, str):
                write_log(f"检测到文本输出，直接使用")
                report_content = output
            elif isinstance(output, dict):
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
            elif isinstance(output, list):
                write_log(f"检测到列表输出，尝试提取第一个元素")
                if len(output) > 0:
                    first_item = output[0]
                    if isinstance(first_item, str):
                        report_content = first_item
                        write_log(f"列表第一个元素是字符串，直接使用: {report_content}")
                    elif isinstance(first_item, dict):
                        if first_item.get('type') == 'document':
                            report_content = first_item.get('data', '')
                            write_log(f"列表第一个元素是文档，URL: {report_content}")
                        elif first_item.get('type') == 'text':
                            report_content = first_item.get('data', '')
                            write_log(f"列表第一个元素是文本，内容: {report_content}")
                        elif 'data' in first_item:
                            report_content = first_item.get('data', '')
                            write_log(f"列表第一个元素通用数据，内容: {report_content}")
                    else:
                        write_log(f"列表第一个元素类型未知: {type(first_item)}")
                else:
                    write_log(f"列表为空，无法提取")
            else:
                write_log(f"未知输出类型: {type(output)}")

            if report_content:
                write_log(f"✓ 返回成功，报告内容长度: {len(report_content)}")
                return jsonify({
                    "success": True,
                    "report_content": report_content,
                    "country": country
                })
            else:
                write_log(f"✗ 报告内容为空，输出数据: {output}")

        if len(outputs) == 0 and len(all_data) > 0:
            write_log("尝试从所有数据中查找输出...")
            for data in reversed(all_data):
                if 'data' in data and 'outputs' in data['data'] and len(data['data']['outputs']) > 0:
                    output = data['data']['outputs'][0]
                    write_log(f"找到输出: {json.dumps(output, ensure_ascii=False)}")

                    report_content = ''
                    if isinstance(output, str):
                        write_log(f"检测到文本输出，直接使用")
                        report_content = output
                    elif isinstance(output, dict):
                        if output.get('type') == 'document':
                            report_content = output.get('data', '')
                            write_log(f"文档类型输出，URL: {report_content}")
                        elif output.get('type') == 'text':
                            report_content = output.get('data', '')
                            write_log(f"文本类型输出，内容: {report_content}")
                        elif 'data' in output:
                            report_content = output.get('data', '')
                            write_log(f"通用数据输出，内容: {report_content}")
                    elif isinstance(output, list):
                        write_log(f"检测到列表输出，尝试提取第一个元素")
                        if len(output) > 0:
                            first_item = output[0]
                            if isinstance(first_item, str):
                                report_content = first_item
                                write_log(f"列表第一个元素是字符串，直接使用: {report_content}")
                            elif isinstance(first_item, dict):
                                if first_item.get('type') == 'document':
                                    report_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文档，URL: {report_content}")
                                elif first_item.get('type') == 'text':
                                    report_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素是文本，内容: {report_content}")
                                elif 'data' in first_item:
                                    report_content = first_item.get('data', '')
                                    write_log(f"列表第一个元素通用数据，内容: {report_content}")

                    if report_content:
                        write_log(f"✓ 从历史数据中找到输出，返回成功，报告内容长度: {len(report_content)}")
                        return jsonify({
                            "success": True,
                            "report_content": report_content,
                            "country": country
                        })
                    break

        write_log(f"✗ 返回错误：状态={workflow_status}, 输出数={len(outputs)}, 状态是否成功={workflow_status in success_statuses}")
        return jsonify({"error": "Report generation failed or no output generated"}), 500

    except requests.exceptions.Timeout:
        write_log(f"生成报告超时")
        return jsonify({"error": "Report generation timeout"}), 500
    except Exception as e:
        write_log(f"生成报告异常: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/translate-image', methods=['POST'])
def translate_image():
    """图片翻译接口（使用OpenAI API）"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400

        file = request.files['image']

        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({"error": "Invalid file type"}), 400

        print(f"\nProcessing: {file.filename}")

        image_b64, original_size = load_and_preprocess_image(file)

        client = init_openai_client()
        completion = client.translate_image(image_b64)

        image_bytes, ext = client.get_image_from_response(completion)

        output_filename = f"translated_{file.filename.rsplit('.', 1)[0]}{ext}"
        return send_file(
            io.BytesIO(image_bytes),
            mimetype='image/jpeg' if ext == '.jpg' else 'image/png',
            as_attachment=True,
            download_name=output_filename
        )

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


# ============= 主程序 ============
if __name__ == '__main__':
    """
    启动 Flask 服务器
    debug=True 允许在代码修改后自动重启服务器
    """
    print("=" * 60)
    print("Dify API Backend Server")
    print("=" * 60)
    print(f"App ID: {APP_ID}")
    
    port = int(os.environ.get('PORT', BACKEND_PORT))
    host = '0.0.0.0'
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    print(f"Server running at: http://{host}:{port}")
    print("=" * 60)
    print("\n可用接口:")
    print("  - GET  /health - 健康检查")
    print("  - POST /api/dify/upload - 上传文档")
    print("  - POST /api/dify/convert - 转公文（阻塔回复）")
    print("  - POST /api/dify/convert-stream - 转公文（流式响应）")
    print("  - POST /api/dify/translate-document - 文档翻译")
    print("  - POST /api/dify/country-report - 生成国别情况报告")
    print("  - POST /api/dify/quarterly-report - 生成季度研究报告")
    print("  - POST /api/translate-image - 图片翻译（OpenAI）")
    print("=" * 60)
    print()

    app.run(host=host, port=port, debug=debug)