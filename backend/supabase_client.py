"""
Supabase 数据库客户端
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime
from typing import List, Dict, Optional
import json

# 加载环境变量
load_dotenv()

# ============= Supabase 配置 =============
# 从环境变量读取配置
SUPABASE_URL = os.getenv("SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "YOUR_SUPABASE_ANON_KEY")

# 验证配置
if not SUPABASE_URL or SUPABASE_URL == "YOUR_SUPABASE_URL":
    raise ValueError("SUPABASE_URL 环境变量未设置，请在 .env 文件中配置")

if not SUPABASE_KEY or SUPABASE_KEY == "YOUR_SUPABASE_ANON_KEY":
    raise ValueError("SUPABASE_KEY 环境变量未设置，请在 .env 文件中配置")

# 初始化 Supabase 客户端
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase client initialization failed: {e}")
    print(f"   SUPABASE_URL: {SUPABASE_URL}")
    print(f"   SUPABASE_KEY: {SUPABASE_KEY[:20]}...")
    supabase = None


# ============= 数据库操作函数 =============

class DatabaseManager:
    """数据库管理器"""

    @staticmethod
    def create_conversion_record(
        user_id: str,
        task_type: str,
        input_file_name: str,
        input_file_id: Optional[str] = None,
        reference_file_name: Optional[str] = None,
        reference_file_id: Optional[str] = None,
        extra_params: Optional[Dict] = None
    ) -> str:
        """
        创建转换记录

        Args:
            user_id: 用户ID
            task_type: 任务类型 (academic_convert, academic_translate, country_situation, country_quarterly, image_translate)
            input_file_name: 输入文件名
            input_file_id: 输入文件ID (Dify file_id)
            reference_file_name: 参考文件名
            reference_file_id: 参考文件ID
            extra_params: 额外参数 (如 style, country, report_type 等)

        Returns:
            记录ID
        """
        import uuid
        record_id = f"conv_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

        data = {
            "id": record_id,
            "user_id": user_id,
            "task_type": task_type,
            "input_file_name": input_file_name,
            "input_file_id": input_file_id,
            "reference_file_name": reference_file_name,
            "reference_file_id": reference_file_id,
            "status": "processing",
            "extra_params": json.dumps(extra_params) if extra_params else None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        try:
            result = supabase.table("conversion_records").insert(data).execute()
            print(f"[OK] Create conversion record: {record_id}")
            return record_id
        except Exception as e:
            print(f"[ERROR] Create conversion record failed: {e}")
            return None

    @staticmethod
    def update_conversion_record(
        record_id: str,
        status: Optional[str] = None,
        output_url: Optional[str] = None,
        output_content: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """
        更新转换记录

        Args:
            record_id: 记录ID
            status: 状态 (processing, completed, error)
            output_url: 输出文件URL
            output_content: 输出内容
            error_message: 错误信息

        Returns:
            是否成功
        """
        update_data = {
            "updated_at": datetime.now().isoformat()
        }

        if status:
            update_data["status"] = status
            if status == "completed":
                update_data["completed_at"] = datetime.now().isoformat()

        if output_url:
            update_data["output_url"] = output_url

        if output_content:
            update_data["output_content"] = output_content

        if error_message:
            update_data["error_message"] = error_message

        try:
            supabase.table("conversion_records").update(update_data).eq("id", record_id).execute()
            print(f"[OK] Update conversion record: {record_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Update conversion record failed: {e}")
            return False

    @staticmethod
    def get_user_conversion_records(user_id: str, task_type: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """
        获取用户的转换记录

        Args:
            user_id: 用户ID
            task_type: 任务类型过滤（可选）
            limit: 返回数量限制

        Returns:
            转换记录列表
        """
        try:
            query = supabase.table("conversion_records").select("*").eq("user_id", user_id)

            if task_type:
                query = query.eq("task_type", task_type)

            result = query.order("created_at", desc=True).limit(limit).execute()
            records = result.data

            # 解析 extra_params JSON
            for record in records:
                if record.get("extra_params"):
                    try:
                        record["extra_params"] = json.loads(record["extra_params"])
                    except:
                        record["extra_params"] = {}

            return records
        except Exception as e:
            print(f"[ERROR] Get conversion records failed: {e}")
            return []

    @staticmethod
    def get_conversion_record(record_id: str) -> Optional[Dict]:
        """获取单个转换记录"""
        try:
            result = supabase.table("conversion_records").select("*").eq("id", record_id).execute()
            if result.data:
                record = result.data[0]
                if record.get("extra_params"):
                    try:
                        record["extra_params"] = json.loads(record["extra_params"])
                    except:
                        record["extra_params"] = {}
                return record
            return None
        except Exception as e:
            print(f"[ERROR] Get conversion record failed: {e}")
            return None

    @staticmethod
    def create_feedback(
        user_id: str,
        feedback_type: str,
        content: str,
        contact: Optional[str] = None
    ) -> str:
        """
        创建用户反馈

        Args:
            user_id: 用户ID
            feedback_type: 反馈类型 (issue, suggestion, other)
            content: 反馈内容
            contact: 联系方式

        Returns:
            反馈ID
        """
        import uuid
        feedback_id = f"feedback_{datetime.now().strftime('%Y%m%d%H%M%S')}_{str(uuid.uuid4())[:8]}"

        data = {
            "id": feedback_id,
            "user_id": user_id,
            "feedback_type": feedback_type,
            "content": content,
            "contact": contact,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        try:
            result = supabase.table("feedbacks").insert(data).execute()
            print(f"[OK] Create feedback: {feedback_id}")
            return feedback_id
        except Exception as e:
            print(f"[ERROR] Create feedback failed: {e}")
            return None

    @staticmethod
    def get_all_feedbacks(
        status: Optional[str] = None,
        feedback_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        获取所有反馈（管理员功能）

        Args:
            status: 状态过滤 (pending, reviewed, resolved)
            feedback_type: 类型过滤
            limit: 返回数量限制

        Returns:
            反馈列表
        """
        try:
            query = supabase.table("feedbacks").select("*")

            if status:
                query = query.eq("status", status)

            if feedback_type:
                query = query.eq("feedback_type", feedback_type)

            result = query.order("created_at", desc=True).limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"✗ 获取反馈列表失败: {e}")
            return []

    @staticmethod
    def update_feedback_status(
        feedback_id: str,
        status: str,
        admin_reply: Optional[str] = None
    ) -> bool:
        """
        更新反馈状态（管理员功能）

        Args:
            feedback_id: 反馈ID
            status: 新状态 (reviewed, resolved)
            admin_reply: 管理员回复

        Returns:
            是否成功
        """
        update_data = {
            "status": status,
            "updated_at": datetime.now().isoformat()
        }

        if admin_reply:
            update_data["admin_reply"] = admin_reply
            update_data["admin_reply_at"] = datetime.now().isoformat()

        try:
            supabase.table("feedbacks").update(update_data).eq("id", feedback_id).execute()
            print(f"✓ 更新反馈状态成功: {feedback_id}")
            return True
        except Exception as e:
            print(f"✗ 更新反馈状态失败: {e}")
            return False

    @staticmethod
    def get_feedback_stats() -> Dict:
        """获取反馈统计信息"""
        try:
            # 获取所有反馈
            result = supabase.table("feedbacks").select("id, status, feedback_type").execute()
            feedbacks = result.data

            stats = {
                "total": len(feedbacks),
                "by_status": {
                    "pending": 0,
                    "reviewed": 0,
                    "resolved": 0
                },
                "by_type": {
                    "issue": 0,
                    "suggestion": 0,
                    "other": 0
                }
            }

            for feedback in feedbacks:
                status = feedback.get("status", "pending")
                feedback_type = feedback.get("feedback_type", "other")

                if status in stats["by_status"]:
                    stats["by_status"][status] += 1

                if feedback_type in stats["by_type"]:
                    stats["by_type"][feedback_type] += 1

            return stats
        except Exception as e:
            print(f"✗ 获取反馈统计失败: {e}")
            return {
                "total": 0,
                "by_status": {"pending": 0, "reviewed": 0, "resolved": 0},
                "by_type": {"issue": 0, "suggestion": 0, "other": 0}
            }


# 导出单例
db = DatabaseManager()
