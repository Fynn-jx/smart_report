"""
服务器启动脚本
从 app.py 导入 Flask 应用并启动服务器
"""
from dotenv import load_dotenv

load_dotenv()

# 从 app.py 导入已配置的 Flask 应用（包含所有路由）
from app import app

if __name__ == '__main__':
    print("=" * 60)
    print("API Server")
    print("=" * 60)
    print("Server starting at: http://127.0.0.1:5000")
    print("=" * 60)
    print()

    app.run(host='127.0.0.1', port=5000, debug=True)
