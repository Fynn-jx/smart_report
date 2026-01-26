# Render 部署指南

本指南说明如何将后端服务部署到 Render 平台。

## 前置要求

- GitHub 账户
- Render 账户（免费或付费）
- 本地开发环境已配置好

## 部署步骤

### 1. 准备代码仓库

确保代码已推送到 GitHub：
```
https://github.com/Sherman-cloud/smart_report
```

### 2. 在 Render 创建新服务

1. 登录 [Render Dashboard](https://dashboard.render.com/)
2. 点击 "New +" 按钮
3. 选择 "Web Service"
4. 连接 GitHub 账户并选择 `smart_report` 仓库
5. 配置服务：

**基本配置：**
- **Name**: `smart-report-backend`（或您喜欢的名称）
- **Region**: 选择离用户最近的区域（如 Singapore, Oregon, Frankfurt）
- **Branch**: `master`
- **Root Directory**: `backend`
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn dify_backend:app --bind 0.0.0.0:$PORT --workers 4 --timeout 120`

**环境变量（在 Environment Variables 中添加）：**

| 变量名 | 值 | 说明 |
|---------|-----|------|
| `PORT` | `5000` | 应用端口 |
| `FLASK_ENV` | `production` | Flask 环境 |
| `PYTHON_VERSION` | `3.9.0` | Python 版本 |
| `ACADEMIC_TO_OFFICIAL_API_KEY` | `app-yVGdpuEwALJTY7CeSkxuNpDo` | 学术转公文 API Key |
| `COUNTRY_SITUATION_API_KEY` | `app-IWiuVAJEEBP8zoDUOME7XKKG` | 国别报告 API Key |
| `QUARTERLY_REPORT_API_KEY` | `app-IzeCySdSIPnMPXGakcgZU4Ry` | 季度报告 API Key |
| `TRANSLATE_API_KEY` | `app-nWremBnU8z7Dq4fm6RXGU2fp` | 翻译 API Key |

6. 点击 "Create Web Service" 开始部署

### 3. 监控部署

Render 会自动：
- 克隆代码仓库
- 安装依赖（`pip install -r requirements.txt`）
- 启动 Gunicorn 服务器
- 分配一个公网 URL

部署过程通常需要 2-5 分钟。

### 4. 访问应用

部署完成后，Render 会提供一个 URL，例如：
```
https://smart-report-backend.onrender.com
```

## 本地测试

在部署前，确保应用在本地正常运行：

```bash
cd backend
pip install -r requirements.txt
python dify_backend.py
```

然后测试 API：
```bash
curl http://127.0.0.1:5000/health
```

## 常见问题

### 1. 部署失败

**问题**：构建失败
**解决方案**：
- 检查 `requirements.txt` 中的依赖是否正确
- 查看 Render 日志获取详细错误信息
- 确保 Python 版本兼容

### 2. 运行时错误

**问题**：应用启动后崩溃
**解决方案**：
- 检查环境变量是否正确设置
- 查看应用日志
- 确保所有 API Key 都已配置

### 3. 超时错误

**问题**：长时间运行的请求超时
**解决方案**：
- 已在 `Procfile` 中设置 `--timeout 120`（2分钟）
- 如需更长超时，可增加此值

### 4. CORS 错误

**问题**：前端无法访问 API
**解决方案**：
- 确保前端 URL 已添加到 CORS 允许列表
- 检查 `flask-cors` 是否正确配置

## 性能优化

### Worker 数量

`Procfile` 中设置了 4 个 workers：
```
--workers 4
```

可根据服务器规格调整：
- 免费套餐：2-4 workers
- 付费套餐：可增加到 8-16 workers

### 超时设置

默认超时为 120 秒（2分钟）：
```
--timeout 120
```

对于长时间运行的任务（如 Dify 工作流），建议：
- 前端实现轮询机制
- 使用流式响应
- 增加 timeout 值

## 监控和日志

### 查看日志

在 Render Dashboard 中：
1. 选择您的服务
2. 点击 "Logs" 标签
3. 查看实时日志流

### 健康检查

应用包含健康检查端点：
```bash
curl https://smart-report-backend.onrender.com/health
```

应返回：
```json
{
  "status": "healthy"
}
```

## 费用说明

Render 免费套餐包含：
- 512 MB RAM
- 0.1 CPU
- 750 小时/月 运行时间
- 免费 SSL 证书

如需更高性能，可升级到付费套餐。

## 更新部署

代码推送到 `master` 分支后，Render 会自动重新部署：
- 检测到新的提交
- 自动触发构建
- 重新部署应用

## 安全建议

1. **不要在代码中硬编码敏感信息**
   - 使用环境变量存储 API Keys
   - 不要提交 `.env` 文件到 Git

2. **定期更新依赖**
   - 运行 `pip install --upgrade -r requirements.txt`
   - 测试新版本兼容性

3. **监控资源使用**
   - 设置告警阈值
   - 定期检查日志

## 联系支持

- Render 文档：https://render.com/docs
- Render 社区：https://community.render.com
- 问题反馈：https://github.com/render/render/issues