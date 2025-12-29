# Vercel 部署指南（私有仓库）

## 前置准备

1. **GitHub/GitLab/Bitbucket 账户**：确保你的代码已推送到私有仓库
2. **Vercel 账户**：如果没有，访问 [vercel.com](https://vercel.com) 注册

## 部署步骤

### 第一步：将代码推送到私有仓库

```bash
# 如果还没有初始化 git
git init

# 添加远程仓库（替换为你的私有仓库地址）
git remote add origin https://github.com/your-username/your-private-repo.git

# 提交并推送代码
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 第二步：在 Vercel 中导入项目

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **"Add New..."** → **"Project"**
3. 在导入页面，选择你的 Git 提供商（GitHub/GitLab/Bitbucket）
4. 如果是首次连接，需要授权 Vercel 访问你的账户
5. 在仓库列表中，找到你的私有仓库并点击 **"Import"**

### 第三步：配置项目设置

#### 3.1 框架预设
- Vercel 会自动检测到 Next.js 项目，无需修改

#### 3.2 环境变量配置
在 **"Environment Variables"** 部分添加以下变量：

```
BACKEND_URL=https://your-backend-url.com
```

**重要提示**：
- `BACKEND_URL` 是你的后端 API 地址（例如：`https://your-backend.vercel.app` 或 `https://api.example.com`）
- 不要包含末尾的斜杠
- 如果后端需要认证，可能需要添加其他环境变量（如 API_KEY 等）

#### 3.3 构建和输出设置
- **Build Command**: `npm run build`（默认）
- **Output Directory**: `.next`（默认，Next.js 会自动处理）
- **Install Command**: `npm install`（默认）

### 第四步：部署

1. 点击 **"Deploy"** 按钮
2. 等待构建完成（通常需要 1-3 分钟）
3. 部署成功后，Vercel 会提供一个预览 URL（格式：`https://your-project-name.vercel.app`）

## 私有仓库授权说明

### GitHub 私有仓库
- Vercel 需要访问你的 GitHub 账户权限
- 在首次连接时，GitHub 会要求你授权 Vercel 访问私有仓库
- 授权后，Vercel 可以读取和部署你的私有仓库

### GitLab 私有仓库
- 需要创建 GitLab Personal Access Token
- 在 Vercel 设置中添加 GitLab 集成时，使用该 Token

### Bitbucket 私有仓库
- 需要创建 Bitbucket App Password
- 在 Vercel 设置中添加 Bitbucket 集成时使用

## 后续更新

### 自动部署
- 每次推送到主分支（main/master）时，Vercel 会自动触发新的部署
- 推送到其他分支会创建预览部署

### 手动部署
1. 在 Vercel Dashboard 中选择项目
2. 点击 **"Deployments"** 标签
3. 点击 **"Redeploy"** 按钮

## 环境变量管理

### 添加/修改环境变量
1. 进入项目设置（Settings）
2. 选择 **"Environment Variables"**
3. 添加或编辑变量
4. 选择应用环境（Production/Preview/Development）
5. 保存后需要重新部署才能生效

### 不同环境使用不同变量
- **Production**: 生产环境变量
- **Preview**: 预览环境变量（用于 PR 预览）
- **Development**: 本地开发环境变量（通过 Vercel CLI 使用）

## 常见问题

### 1. 构建失败
- 检查 `package.json` 中的依赖是否正确
- 查看构建日志中的错误信息
- 确保 Node.js 版本兼容（Next.js 16 需要 Node.js 18+）

### 2. 环境变量未生效
- 确保变量名称正确（区分大小写）
- 重新部署项目
- 检查变量是否应用到了正确的环境

### 3. API 请求失败
- 检查 `BACKEND_URL` 环境变量是否正确设置
- 确认后端服务可访问
- 检查 CORS 配置

### 4. 私有仓库访问权限
- 确保 Vercel 已正确授权访问你的 Git 提供商
- 检查仓库的访问权限设置

## 使用 Vercel CLI（可选）

如果你想在本地使用 Vercel CLI：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署到预览环境
vercel

# 部署到生产环境
vercel --prod
```

## 项目特定配置

本项目已配置：
- ✅ Next.js 16.1.1
- ✅ Server Actions 支持
- ✅ API 代理配置（通过 `next.config.ts` 中的 rewrites）
- ✅ 环境变量支持（`BACKEND_URL`）

## 高德地图 API 配置

⚠️ **重要**：高德地图需要配置两种类型的 API Key

| 环境变量 | Key 类型 | 用途 |
|---------|---------|-----|
| `NEXT_PUBLIC_AMAP_KEY` | Web 端 (JS API) | 前端浏览器地图显示、地理编码 |
| `AMAP_SERVER_KEY` | Web 服务 | 服务端代理请求（如地址输入提示） |

在高德开放平台 (https://console.amap.com/) 创建应用时：
1. 添加 **Web 端 (JS API 安全密钥版)** 类型的 Key → 配置为 `NEXT_PUBLIC_AMAP_KEY`
2. 添加 **Web 服务** 类型的 Key → 配置为 `AMAP_SERVER_KEY`

若只配置一个 Key 或类型不匹配，会报 `USERKEY_PLAT_NOMATCH` 错误。

## 注意事项

1. **后端地址**：确保 `BACKEND_URL` 环境变量指向可访问的后端服务
2. **CORS**：如果后端在不同域名，确保后端配置了正确的 CORS 策略
3. **高德 API 密钥**：需配置两种类型的 Key（见上方说明）
4. **构建时间**：免费版 Vercel 账户有构建时间限制，注意优化构建速度

## 参考链接

- [Vercel 部署文档](https://vercel.com/docs)
- [Next.js 部署指南](https://nextjs.org/docs/app/building-your-application/deploying)
- [Vercel 环境变量](https://vercel.com/docs/projects/environment-variables)

