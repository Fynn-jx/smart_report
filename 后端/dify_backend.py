import os
import requests
import json
import time
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from typing import Optional, Generator
from datetime import datetime

# ============= 配置区域 =============
ACADEMIC_TO_OFFICIAL_API_KEY = "app-yVGdpuEwALJTY7CeSkxuNpDo"  # Dify API Key for 学术报告转公文
COUNTRY_SITUATION_API_KEY = "app-IWiuVAJEEBP8zoDUOME7XKKG"  # Dify API Key for 国别情况报告
QUARTERLY_REPORT_API_KEY = "app-IzeCySdSIPnMPXGakcgZU4Ry"  # Dify API Key for 季度研究报告
TRANSLATE_API_KEY = "app-nWremBnU8z7Dq4fm6RXGU2fp"  # Dify API Key for 文档翻译
DIFY_BASE_URL = "https://api.dify.ai/v1"
APP_ID = "Dify"  # Dify App ID

# 后端配置
BACKEND_PORT = 5000

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
    print(message)  # 同时打印到控制台


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

        if not file_id:
            return jsonify({"error": "file_id is required"}), 400

        write_log(f"\n{'='*60}")
        write_log(f"转公文请求: file_id={file_id}, format={output_format}")

        # 构建工作流输入
        workflow_inputs = {
            "wenjian": {
                "type": "document",
                "transfer_method": "local_file",
                "upload_file_id": file_id
            }
        }

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
                write_log(f"✓ 返回成功，输出URL: {output_url}")
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

        write_log(f"\n{'='*60}")
        write_log(f"国别报告请求: country={country}, type={report_type}")

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

        write_log(f"\n{'='*60}")
        write_log(f"季度报告请求: country={country}")

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
    print("  - POST /api/dify/convert - 转公文（阻塔回复）")
    print("  - POST /api/dify/convert-stream - 转公文（流式响应）")
    print("  - POST /api/dify/country-report - 生成国别情况报告")
    print("  - POST /api/dify/quarterly-report - 生成季度研究报告")
    print("  - POST /api/dify/translate-document - 文档翻译")
    print("=" * 60)

    app.run(host='127.0.0.1', port=BACKEND_PORT, debug=True)


if __name__ == '__main__':
    main()
