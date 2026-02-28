# 🚀 Supabase 数据库配置指南

## 📋 配置步骤

### 1️⃣ 创建 Supabase 项目

1. 访问 https://supabase.com
2. 注册/登录账号
3. 点击 "New Project"
4. 填写项目信息：
   - **Name**: 中国人民银行智能公文系统
   - **Database Password**: 设置一个强密码（请保存好）
   - **Region**: 选择离你最近的区域（如 Northeast Asia (Seoul)）
5. 等待项目创建完成（约2分钟）

---

### 2️⃣ 执行 SQL 脚本创建表

1. 进入 Supabase Dashboard
2. 点击左侧菜单 **SQL Editor**
3. 点击 **New Query**
4. 复制 `backend/supabase_schema.sql` 文件的全部内容
5. 粘贴到编辑器中
6. 点击 **Run** 执行
7. 看到成��提示后，表创建完成

---

### 3️⃣ 获取 API 凭证

1. 在 Supabase Dashboard 中
2. 点击左侧菜单 **Project Settings** (齿轮图标)
3. 选择 **API**
4. 找到以下信息：
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. 复制这两个值

---

### 4️⃣ 配置后端环境变量

在 `backend` 目录下创建 `.env` 文件：

```bash
cd backend
```

创建 `.env` 文件并填入：

```env
# Supabase 配置
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ 注意：将 `xxxxx` 替换为你的实际值

---

### 5️⃣ 安装 Python 依赖

```bash
cd backend
pip install python-dotenv
```

> 注意：`supabase` 包已经在之前安装完成

---

### 6️⃣ 测试数据库连接

创建测试文件 `backend/test_supabase.py`：

```python
import os
from dotenv import load_dotenv
from supabase_client import db

# 加载环境变量
load_dotenv()

# 测试创建记录
record_id = db.create_conversion_record(
    user_id="test_user",
    task_type="academic_convert",
    input_file_name="test.pdf",
    input_file_id="test_file_id_123"
)

print(f"创建记录ID: {record_id}")

# 测试读取记录
records = db.get_user_conversion_records("test_user")
print(f"读取到 {len(records)} 条记录")

# 测试反馈
feedback_id = db.create_feedback(
    user_id="test_user",
    feedback_type="suggestion",
    content="这是一条测试反馈"
)
print(f"创建反馈ID: {feedback_id}")
```

运行测试：

```bash
python test_supabase.py
```

如果看到输出记录ID，说明配置成功！

---

## 🔧 验证数据

### 方法1：Supabase Dashboard 查看

1. 进入 Supabase Dashboard
2. 点击左侧菜单 **Table Editor**
3. 查看两个表：
   - `conversion_records` - 转换记录
   - `feedbacks` - 用户反馈

### 方法2：使用 API 查询

访问：`http://localhost:5000/api/conversions?user_id=test_user`

---

## 📊 数据库表结构

### conversion_records（转换记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(100) | 主键，格式：conv_20250225123456_abc123 |
| user_id | VARCHAR(100) | 用户ID |
| task_type | VARCHAR(50) | 任务类型 |
| input_file_name | VARCHAR(500) | 输入文件名 |
| input_file_id | VARCHAR(200) | Dify文件ID |
| reference_file_name | VARCHAR(500) | 参考文件名 |
| reference_file_id | VARCHAR(200) | 参考文件ID |
| output_url | TEXT | 输出URL |
| output_content | TEXT | 输出内容 |
| status | VARCHAR(20) | 状态：processing/completed/error |
| extra_params | TEXT | 额外参数（JSON） |
| error_message | TEXT | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| completed_at | TIMESTAMP | 完成时间 |

### feedbacks（反馈表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(100) | 主键 |
| user_id | VARCHAR(100) | 用户ID |
| feedback_type | VARCHAR(20) | 类型：issue/suggestion/other |
| content | TEXT | 反馈内容 |
| contact | VARCHAR(200) | 联系方式 |
| status | VARCHAR(20) | 状态：pending/reviewed/resolved |
| admin_reply | TEXT | 管理员回复 |
| admin_reply_at | TIMESTAMP | 回复时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

## 🎯 下一步

配置完成后，你将拥有：

✅ 自动记录所有转换操作的历史
✅ 永久保存用户反馈
✅ 可以查询历史记录
✅ 可以管理用户反馈
✅ 支持多用户（未来添加登录功能后）

---

## 📝 注意事项

1. **环境变量安全**：不要将 `.env` 文件提交到 Git
2. **数据库备份**：Supabase 会自动备份，也可以手动导出
3. **免费额度**：
   - 500MB 数据库存储
   - 2GB 文件存储
   - 50,000 API 请求/月
   - 1GB 出站流量/月

---

需要帮助？查看：
- Supabase 文档：https://supabase.com/docs
- Python 客户端文档：https://supabase.com/docs/reference/python
