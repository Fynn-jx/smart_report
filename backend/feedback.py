from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

# ============= 配置区域 =============
FEEDBACK_FILE = 'feedbacks.json'
APP_ID = "Feedback"
BACKEND_PORT = 5001
# =====================================

app = Flask(__name__)
# CORS配置
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://banksmart-report.vercel.app",
            "https://smart-report-jade.vercel.app"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})


def load_feedbacks():
    """加载所有反馈"""
    if not os.path.exists(FEEDBACK_FILE):
        return []

    try:
        with open(FEEDBACK_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载反馈文件失败: {e}")
        return []


def save_feedback(feedback_data):
    """保存反馈到文件"""
    try:
        feedbacks = load_feedbacks()

        # 添加新反馈
        feedbacks.append(feedback_data)

        # 保存到文件
        with open(FEEDBACK_FILE, 'w', encoding='utf-8') as f:
            json.dump(feedbacks, f, ensure_ascii=False, indent=2)

        print(f"✓ 反馈已保存: {feedback_data.get('id')}")
        return True
    except Exception as e:
        print(f"✗ 保存反馈失败: {e}")
        return False


def format_feedback_type(type_value):
    """格式化反馈类型"""
    type_map = {
        'issue': '问题反馈',
        'suggestion': '功能建议',
        'other': '其他'
    }
    return type_map.get(type_value, type_value)


# ============= API 路由 ============

@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({
        "status": "ok",
        "message": "Feedback API Server is running",
        "app_id": APP_ID
    })


@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """提交反馈"""
    try:
        data = request.get_json()

        # 验证必需字段
        if not data.get('content'):
            return jsonify({"error": "反馈内容不能为空"}), 400

        # 创建反馈记录
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
        print(f"提交反馈异常: {e}")
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
        print(f"获取反馈异常: {e}")
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

        return jsonify({
            "success": True,
            "message": "状态更新成功"
        }), 200

    except Exception as e:
        print(f"更新反馈状态异常: {e}")
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
        print(f"获取统计信息异常: {e}")
        return jsonify({"error": str(e)}), 500


# ============= 主程序 =============
if __name__ == '__main__':
    print("=" * 60)
    print("Feedback API Server")
    print("=" * 60)
    print(f"App ID: {APP_ID}")

    port = int(os.environ.get('PORT', BACKEND_PORT))
    host = '0.0.0.0'
    debug = os.environ.get('FLASK_ENV') != 'production'

    print(f"Server running at: http://{host}:{port}")
    print("=" * 60)
    print("\n可用接口:")
    print("  - GET  /health - 健康检查")
    print("  - POST /api/feedback - 提交反馈")
    print("  - GET  /api/feedback - 获取所有反馈")
    print("  - PATCH /api/feedback/<id> - 更新反馈状态")
    print("  - GET  /api/feedback/stats - 获取统计信息")
    print("=" * 60)
    print(f"\n反馈数据文件: {os.path.abspath(FEEDBACK_FILE)}")
    print()

    app.run(host=host, port=port, debug=debug)
