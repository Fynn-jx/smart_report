# 🚀 快速启动指南 - 反馈功能

## ✅ 已完成！

反馈功能已成功集成到主后端服务，无需额外启动服务！

---

## 🎯 3步开始使用

### 1️⃣ 启动后端服务

```bash
cd backend
python dify_backend.py
```

看到以下输出说明启动成功：
```
============================================================
Dify API Backend Server
============================================================
App ID: Dify
Server running at: http://127.0.0.1:5000
============================================================

可用接口:
  - POST /api/feedback - 提交反馈
  - GET  /api/feedback - 获取所有反馈
  - GET  /api/feedback/stats - 获取反馈统计
  - PATCH /api/feedback/<id> - 更新反馈状态
============================================================
```

### 2️⃣ 启动前端服务

```bash
cd frontend
npm run dev
```

### 3️⃣ 测试反馈功能

**方式1：运行测试脚本**
```bash
cd backend
python test_feedback.py
```

**方式2：通过浏览器测试**
1. 打开前端应用：http://localhost:5173
2. 登录系统
3. 点击右上角"反馈"按钮
4. 填写并提交反馈

**方式3：测试管理员后台**
1. 打开文件：`backend/feedback_admin.html`
2. 查看反馈统计和列表

---

## 📊 数据存储

反馈数据保存在：`backend/feedbacks.json`

自动创建，无需手动配置。

---

## 🎉 完成！

现在你的系统拥有完整的反馈功能：

- ✅ 用户��以提交问题和建议
- ✅ 管理员可以查看所有反馈
- ✅ 支持按状态和类型筛选
- ✅ 一键标记反馈状态
- ✅ 实时统计信息

---

## 🔧 如果遇到问题

### 问题1：CORS错误

**症状**：前端报错 "Access to fetch at 'http://localhost:5000/api/feedback' has been blocked by CORS policy"

**解决**：
1. 确保运行的是 `dify_backend.py`（不是 `feedback.py`）
2. 检查后端是否在端口5000运行
3. 重启后端服务

### 问题2：无法连接到服务器

**症状**：前端报错 "Failed to fetch"

**解决**：
1. 运行测试脚本验证API：`python test_feedback.py`
2. 检查后端是否正在运行
3. 确认端口号是5000（不是5001）

### 问题3：管理员后台无法加载

**症状**：打开 `feedback_admin.html` 显示加载失败

**解决**：
1. 确保后端正在运行（`python dify_backend.py`）
2. 按F12打开浏览器控制台查看错误
3. 直接访问 http://localhost:5000/health 测试连接

---

## 📝 文件清单

```
backend/
├── dify_backend.py        # 主后端服务（已包含反馈API）
├── feedback_admin.html    # 管理员后台页面
├── feedbacks.json         # 反馈数据文件（自动生成）
├── test_feedback.py       # 测试脚本
└── FEEDBACK_README.md     # 完整文档

frontend/
└── app/components/
    ├── FeedbackModal.tsx   # 反馈表单组件
    └── MainPage.tsx        # 已添加反馈按钮
```

---

## 💡 提示

- **不需要**运行 `feedback.py`（单独的反馈服务）
- 所有API都在 `dify_backend.py` 的端口5000上
- 反馈数据自动保存在 `feedbacks.json`
- 定期备份 `feedbacks.json` 以防止数据丢失

---

开始使用吧！🎊
