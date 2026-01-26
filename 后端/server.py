from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os, io, base64, json, time
from PIL import Image
import requests
from openai import OpenAI

# ============= 配置区域 =============
API_KEY = "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"
API_URL = "https://openrouter.ai/api/v1"
MODEL_NAME = "google/gemini-3-pro-image-preview"
MAX_IMAGE_SIZE = 1600
JPEG_QUALITY = 85
MAX_RETRIES = 5
RETRY_DELAY = 10
DOWNLOAD_TIMEOUT = 180
PROMPT = "帮我生成图片：请检查图中的所有英文，包括竖写和横写，并将英文翻译为简体中文，其余元素保持不变。原比例。"
# =====================================

# 创建 Flask 应用
# Flask 是一个轻量级的 Python Web 框架，用于创建 API 接口
app = Flask(__name__)
# CORS 允许前端页面（不同域名）访问这个 API
# 这是现代 Web 开发的标准做法，因为前端和后端通常运行在不同端口
CORS(app)

# 初始化 OpenAI 客户端，用于调用图片翻译 API
client = OpenAI(base_url=API_URL, api_key=API_KEY)


def load_and_preprocess_image(image_file):
    """
    加载并预处理图片
    将上传的图片文件转换为 base64 编码，方便发送给 API
    如果图片太大，会自动缩放到合理尺寸
    """
    try:
        # 从内存中打开图片文件
        im = Image.open(image_file).convert("RGB")
        w, h = im.size

        # 如果图片太大，进行缩放（节省 API 调用成本和时间）
        m = max(w, h)
        if m > MAX_IMAGE_SIZE:
            scale = MAX_IMAGE_SIZE / float(m)
            new_w, new_h = int(w * scale), int(h * scale)
            im = im.resize((new_w, new_h), Image.LANCZOS)
            print(f"  Resized: {w}x{h} -> {new_w}x{new_h}")

        # 将图片保存到内存中，然后转换为 base64
        # base64 是一种将二进制数据转换为文本的编码方式
        # 这样图片可以通过 JSON 格式发送给 API
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return b64, (w, h)
    except Exception as e:
        print(f"Error processing image: {e}")
        raise


def extract_items_from_completion(completion):
    """
    从 API 响应中递归提取所有图片数据
    API 返回的数据结构可能很复杂，图片可能嵌套在不同的字段中
    这个函数会遍历整个响应对象，找出所有可能的图片链接或 base64 数据
    """
    import re
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

    # 转换completion为可遍历的对象
    if hasattr(completion, "model_dump"):
        obj = completion.model_dump()
    elif hasattr(completion, "__dict__"):
        obj = completion.__dict__
    else:
        obj = {"raw": str(completion)}

    walk(obj)
    return items


def call_api_with_retry(image_b64):
    """
    调用 OpenRouter API 进行图片翻译
    带有重试机制，因为网络问题或 API 限流可能导致偶尔失败
    """
    for attempt in range(MAX_RETRIES):
        try:
            print(f"API call attempt {attempt + 1}/{MAX_RETRIES}...")

            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
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

            print("API call successful!")
            return completion

        except Exception as e:
            print(f"API error (attempt {attempt + 1}): {e}")

            if attempt < MAX_RETRIES - 1:
                wait_time = RETRY_DELAY * (attempt + 1)
                print(f"Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                print(f"All {MAX_RETRIES} attempts failed")
                raise


def get_image_from_response(completion):
    """
    从 API 响应中提取图片
    图片可能以 URL 或 base64 格式返回
    返回一个 (图片字节, 文件扩展名) 的元组
    """
    all_items = extract_items_from_completion(completion)
    if not all_items:
        raise Exception("No image found in response")

    image_item = all_items[0]

    if image_item["type"] == "http":
        # 如果是 URL，需要下载图片
        r = requests.get(image_item["url"], timeout=DOWNLOAD_TIMEOUT)
        r.raise_for_status()
        return r.content, ".jpg"
    else:
        # 如果是 base64，直接解码
        fmt = image_item["fmt"]
        b64 = image_item["b64"]
        ext = ".jpg" if fmt in ("jpeg", "jpg") else ".png"
        return base64.b64decode(b64), ext


# ============ API 路由 ============

# 健康检查接口
# 用于测试服务器是否正常运行
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Server is running"})


# 图片翻译接口
# 前端通过 POST 请求发送图片到这里
@app.route('/api/translate', methods=['POST'])
def translate():
    """
    处理图片翻译请求
    接收上传的图片，调用 API 翻译，返回翻译后的图片
    """
    try:
        # 检查是否有文件上传
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400

        file = request.files['image']

        # 检查文件名是否为空
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # 验证文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({"error": "Invalid file type"}), 400

        print(f"\nProcessing: {file.filename}")

        # 1. 预处理图片（转换为 base64）
        image_b64, original_size = load_and_preprocess_image(file)

        # 2. 调用 API 进行翻译
        completion = call_api_with_retry(image_b64)

        # 3. 从响应中提取图片
        image_bytes, ext = get_image_from_response(completion)

        # 4. 直接返回图片（作为文件下载）
        # 返回图片文件而不是 JSON，前端可以直接显示和下载
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


# ============ 主程序 ============

if __name__ == '__main__':
    """
    启动 Flask 服务器
    debug=True 允许在代码修改后自动重启服务器
    """
    print("=" * 60)
    print("Image Translation API Server")
    print("=" * 60)
    print("Server starting at: http://127.0.0.1:5000")
    print("API endpoint: http://127.0.0.1:5000/api/translate")
    print("=" * 60)
    print()

    app.run(host='127.0.0.1', port=5000, debug=True)
