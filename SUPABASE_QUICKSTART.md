# 🚀 Supabase 快速配置指南

## 第一步：创建 Supabase 项目（5分钟）

### 1. 注册并创建项目

1. 打开 https://supabase.com
2. 点击 **Start your project**
3. 使用 GitHub 账号登录（推荐）
4. 点击 **New Project**
5. 填写信息：
   - **Name**: `公文系统`
   - **Database Password**: 设置密码并保存
   - **Region**: `Northeast Asia (Seoul)` 首尔
6. 点击 **Create new project**，等待2-3分钟

---

## 第二步：创建数据库表（2分钟）

### 1. 打开 SQL Editor

1. 在 Supabase Dashboard 左侧菜单
2. 点击 **SQL Editor**（图标是代码）
3. 点击 **New Query**

### 2. 执行 SQL 脚本

1. 打开文件：`backend/supabase_schema.sql`
2. 复制全部内容
3. 粘贴到 SQL Editor
4. 点击 **Run** 或按 `Ctrl + Enter`
5. 看到 "数据库表结构创建完成！" 提示即成功

---

## 第三步：获取 API 密钥（1分钟）

### 1. 找到 API 配置

1. 在 Supabase Dashboard
2. 点击左侧 **Project Settings**（齿轮图标）
3. 选择 **API**

### 2. 复制两个值

```
Project URL: https://xxxxx.supabase.co
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **复制这两个值，下一步要用**

---

## 第四步：配置后端（2分钟）

### 1. 创建 .env 文件

在 `backend` 目录下创建 `.env` 文件：

```bash
# 进入 backend 目录
cd F:/PDF图片提取器/backend
```

创建 `.env` 文件，内容如下：

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **将 `xxxxx` 替换为你的实际值**

### 2. 测试配置

```bash
# 安装依赖
pip install python-dotenv

# 测试数据库连接
python test_supabase.py
```

看到输出 "创建记录ID: conv_xxx" 即配置成功！

---

## 第五步：启动后端（1分钟）

```bash
cd F:/PDF图片提取器/backend
python dify_backend.py
```

看到以下输出表示成功：

```
============================================================
Dify API Backend Server
============================================================
✓ Supabase 数据库已启用
Server running at: http://127.0.0.1:5000
============================================================
```

---

## ✅ 验证配置

### 测试 1：查看 Supabase 表数据

1. 进入 Supabase Dashboard
2. 点击 **Table Editor**
3. 查看是否有两个表：
   - `conversion_records`
   - `feedbacks`

### 测试 2：测试 API

访问：http://localhost:5000/health

返回：`{"status": "ok", ...}`

### 测试 3：测试前端

```bash
cd frontend
npm run dev
```

1. 打开 http://localhost:5173
2. 登录系统
3. 执行任意功能（如转公文）
4. 打开 Supabase Dashboard -> Table Editor -> conversion_records
5. 应该能看到新增的记录

---

## 🎯 配置完成！

现在你的系统已经集成了 Supabase 数据库：

✅ 自动记录所有操作历史
✅ 永久保存用户反馈
✅ 支持多用户（未来）
✅ 数据实时同步
✅ 自动备份

---

## 🔧 常见问题

### Q1: 提示 "Database not enabled"

**解决**：检查 `.env` 文件是否在 `backend` 目录下，内容是否正确

### Q2: 提示 "relation does not exist"

**解决**：没有执行 SQL 脚本，请按照第二步执行 `supabase_schema.sql`

### Q3: Supabase 仪表盘看不到数据

**解决**：
1. 确认后端已启动
2. 执行一次前端操作（如上传文件）
3. 在 Supabase Dashboard 点击刷新按钮

### Q4: Python 报错 "No module named 'dotenv'"

**解决**：
```bash
pip install python-dotenv
```

---

## 📊 下一步

配置完成后，你可以：

1. **查看历史记录**：前端会自动显示所有操作历史
2. **管理用户反馈**：在 Supabase Dashboard 中查看
3. **数据分析**：使用 Supabase 的数据分析功能
4. **添加用户认证**：未来可以添加登录功能

---

## 📞 需要帮助？

查看完整文档：`backend/SUPABASE_SETUP.md`
