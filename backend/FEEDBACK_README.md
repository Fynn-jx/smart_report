# 反馈功能使用说明

## 📬 功能概述

已成功添加用户反馈功能，用户可以在系统中提交问题和建议，管理员可以在后台查看和处理这些反馈。

**✅ 反馈功能已集成到主后端服务中，无需额外启动服务！**

---

## 🚀 启动服务

### 启动方式（推荐）

```bash
# 后端服务（已包含反馈API）
cd backend
python dify_backend.py
# 服务运行在 http://localhost:5000

# 前端应用
cd frontend
npm run dev
```

### 单独启动反馈服务（不推荐）

如果你想单独运行反馈服务（端口5001）：

```bash
cd backend
python feedback.py
```

但这需要修改前端代码的API地址，所以**不推荐**此方式。

---

## 🎯 功能特性

### 前端功能

1. **反馈入口**
   - 位置：导航栏右上角，"反馈"按钮
   - 图标：MessageCircle（对话气泡图标）

2. **反馈表单**
   - 反馈类型选择（问题反馈/功能建议/其他）
   - 反馈内容输入（最多500字符）
   - 联系方式（可选）
   - 实时字符计数
   - 提交状态反馈

3. **用户体验**
   - 提交成功后自动关闭（2秒）
   - 提交中显示加载动画
   - 错误提示和表单验证

### 后端API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/feedback` | POST | 提交反馈 |
| `/api/feedback` | GET | 获取所有反馈 |
| `/api/feedback/<id>` | PATCH | 更新反馈状态 |
| `/api/feedback/stats` | GET | 获取统计信息 |

### 管理员后台

打开文件：`backend/feedback_admin.html`

功能：
- 📊 实时统计面板（总数/待处理/已查看/已解决）
- 🔍 按状态和类型筛选
- 📝 查看反馈详情
- ✅ 标记反馈状态（已查看/已解决）
- 🔄 自动刷新（每30秒）

---

## 📂 文件结构

```
backend/
├── feedback.py           # 反馈API服务
├── feedback_admin.html   # 管理员后台页面
└── feedbacks.json        # 反馈数据存储文件（自动生成）

frontend/
└── app/components/
    └── FeedbackModal.tsx # 反馈表单组件
```

---

## 💡 使用流程

### 用户提交反馈

1. 登录系统
2. 点击右上角"反馈"按钮
3. 选择反馈类型（问题/建议/其他）
4. 填写反馈内容
5. （可选）填写联系方式
6. 点击"提交反馈"
7. 等待提交成功提示

### 管理员处理反馈

1. 打开 `backend/feedback_admin.html`
2. 查看统计面板和反馈列表
3. 阅读反馈内容
4. 根据需要标记状态：
   - **已查看**：已阅读该反馈
   - **已解决**：问题已处理完成
5. 如需回复，可通过反馈中留的联系方式联系用户

---

## 📊 反馈数据格式

反馈存储在 `feedbacks.json` 文件中，格式如下：

```json
[
  {
    "id": "feedback_20241209123456_123456",
    "type": "issue",
    "content": "用户反馈的内容",
    "contact": "user@email.com",
    "timestamp": "2024-12-09T12:34:56.123456",
    "status": "pending",
    "created_at": "2024-12-09T12:34:56.123456"
  }
]
```

字段说明：
- `id`: 唯一标识符
- `type`: 反馈类型（issue/suggestion/other）
- `content`: 反馈内容
- `contact`: 联系方式（可选）
- `timestamp`: 提交时间
- `status`: 处理状态（pending/reviewed/resolved）
- `created_at`: 创建时间

---

## 🔧 API示例

### 提交反馈

```bash
curl -X POST http://localhost:5000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "type": "suggestion",
    "content": "希望添加批量上传功能",
    "contact": "user@example.com"
  }'
```

### 获取所有反馈

```bash
curl http://localhost:5000/api/feedback
```

### 筛选反馈

```bash
# 只获取待处理的问题反馈
curl "http://localhost:5000/api/feedback?status=pending&type=issue"
```

### 更新反馈状态

```bash
curl -X PATCH http://localhost:5000/api/feedback/feedback_20241209123456_123456 \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

### 获取统计信息

```bash
curl http://localhost:5000/api/feedback/stats
```

---

## 🎨 自定义配置

### 修改端口

编辑 `feedback.py`:

```python
BACKEND_PORT = 5001  # 修改为其他端口
```

### 修改数据文件路径

编辑 `feedback.py`:

```python
FEEDBACK_FILE = 'feedbacks.json'  # 修改为其他路径
```

### 修改CORS配置

编辑 `feedback.py` 中的 `CORS` 配置，添加允许的前端域名。

---

## 📝 注意事项

1. **数据安全**
   - `feedbacks.json` 文件包含用户提交的反馈，请妥善保管
   - 建议定期备份此文件

2. **并发处理**
   - 当前使用JSON文件存储，适合中小规模使用
   - 如需高并发，建议改用数据库（SQLite/MySQL/PostgreSQL）

3. **权限控制**
   - 管理员后台页面无权限验证
   - 建议在生产环境中添加身份验证

4. **自动刷新**
   - 管理员后台每30秒自动刷新一次
   - 可在 `feedback_admin.html` 中修改刷新间隔

---

## 🚨 故障排查

### 问题：前端无法提交反馈

**检查项：**
1. 确认 `feedback.py` 是否正在运行（端口5001）
2. 检查浏览器控制台是否有CORS错误
3. 确认API地址配置正确（`http://localhost:5001`）

### 问题：管理员后台无法加载

**检查项：**
1. 确认 `feedback.py` 是否正在运行
2. 直接访问 `http://localhost:5001/health` 检查服务状态
3. 检查浏览器控制台的错误信息

### 问题：反馈数据丢失

**解决方案：**
1. 检查 `feedbacks.json` 文件是否存在
2. 检查文件权限，确保服务有读写权限
3. 从备份恢复数据（如果有）

---

## 🎉 完成

反馈功能已全部配置完成，现在可以：

1. ✅ 用户可以提交反馈
2. ✅ 管理员可以查看反馈
3. ✅ 管理员可以更新反馈状态
4. ✅ 查看反馈统计信息

祝使用愉快！🎊
