# OpenClaw Chat - Deployment Guide

## 前置条件

- Node.js 24+ (推荐使用 LTS 版本)
- npm 或 pnpm
- OpenClaw Gateway 正在运行（可访问的 WebSocket 端点）

## 构建步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 构建生产版本

```bash
npm run build
```

构建产物位于 `.next/` 目录。

### 3. 验证构建

```bash
npm run start
```

访问 http://localhost:3000 验证应用正常运行。

## 部署方式

### 方式 1: Gateway 静态文件服务

将 OpenClaw Chat 作为 Gateway 的静态文件服务部署。

**步骤**:

1. 配置 `next.config.ts` 启用静态导出：

```typescript
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
```

2. 构建静态文件：

```bash
npm run build
```

3. 将 `out/` 目录内容复制到 Gateway 静态文件目录：

```bash
cp -r out/* /path/to/gateway/static/chat/
```

4. 配置 Gateway 路由（示例）：

```yaml
# gateway config
static:
  - path: /chat
    dir: ./static/chat
```

**优点**:
- 部署简单
- 与 Gateway 共享域名，无跨域问题
- 适合单一部署场景

**缺点**:
- 需要 Gateway 支持静态文件服务
- 更新需要重启 Gateway

---

### 方式 2: 独立 Nginx 部署

使用 Nginx 作为独立 Web 服务器。

**步骤**:

1. 构建应用：

```bash
npm run build
```

2. 使用 `next export` 或配置静态导出生成 `out/` 目录

3. 配置 Nginx：

```nginx
server {
    listen 80;
    server_name chat.example.com;

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 静态文件
    root /var/www/openclaw-chat;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 如果 Gateway 和 Chat 不在同一域名，可能需要 WebSocket 代理
    # location /ws {
    #     proxy_pass http://gateway.example.com:18789;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection "upgrade";
    #     proxy_set_header Host $host;
    # }
}
```

4. 部署文件：

```bash
# 复制构建产物
cp -r out/* /var/www/openclaw-chat/

# 重启 Nginx
sudo nginx -s reload
```

**优点**:
- 灵活配置
- 可与其他服务共存
- 支持自定义域名和 SSL

**缺点**:
- 需要单独配置 Nginx
- 可能存在跨域问题（需要 Gateway 配置 CORS）

---

### 方式 3: Vercel / Netlify 部署

使用云平台自动部署。

#### Vercel

1. 连接 GitHub 仓库
2. Vercel 自动检测 Next.js 项目
3. 点击部署

**注意**: 需要在 Vercel 设置中配置环境变量（如有）。

#### Netlify

1. 连接 GitHub 仓库
2. 构建命令: `npm run build`
3. 发布目录: `out` (需要配置静态导出)
4. 点击部署

**优点**:
- 零配置 CI/CD
- 自动 HTTPS
- 全球 CDN
- 预览部署

**缺点**:
- 跨域需要 Gateway 配置
- 免费版有带宽限制

---

## 环境变量

OpenClaw Chat 是纯前端应用，大部分配置存储在浏览器 localStorage 中。

### 可选环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_DEFAULT_GATEWAY_URL` | 默认 Gateway URL | - |
| `NEXT_PUBLIC_APP_VERSION` | 应用版本 | package.json 中的版本 |

### 使用方式

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_DEFAULT_GATEWAY_URL=ws://127.0.0.1:18789
```

## Gateway 配置

### CORS 配置

如果 Chat 和 Gateway 不在同一域名，需要在 Gateway 配置 CORS：

```yaml
# gateway config
cors:
  allowed_origins:
    - https://chat.example.com
    - http://localhost:3000
```

### WebSocket 端点

默认 Gateway WebSocket 端点：

```
ws://127.0.0.1:18789
```

生产环境应使用安全连接：

```
wss://gateway.example.com
```

## 常见问题

### 1. 连接 Gateway 失败

**症状**: 显示"未连接到 Gateway"或连接超时

**排查**:

1. 检查 Gateway 是否运行：
   ```bash
   curl http://127.0.0.1:18789/health
   ```

2. 检查防火墙是否阻止 WebSocket 连接

3. 检查 Gateway URL 是否正确（包括协议 ws/wss）

4. 如果使用 HTTPS 页面，Gateway 必须使用 WSS

### 2. 跨域错误

**症状**: 浏览器控制台显示 CORS 错误

**解决方案**:

1. 在 Gateway 配置中添加前端域名到 `allowed_origins`

2. 或将 Chat 部署到与 Gateway 相同的域名下

### 3. WebSocket 连接断开

**症状**: 连接频繁断开重连

**排查**:

1. 检查网络稳定性

2. 检查 Gateway 日志

3. 检查是否有代理/负载均衡器超时设置

4. 考虑增加心跳间隔

### 4. 静态资源 404

**症状**: JavaScript/CSS 文件加载失败

**解决方案**:

1. 确保 `_next/static/` 目录存在

2. 检查 Nginx 配置中的 root 路径

3. 确保 `next.config.ts` 中 `assetPrefix` 配置正确（如使用子路径部署）

### 5. 路由刷新 404

**症状**: 直接访问或刷新非首页路由返回 404

**解决方案**:

确保 Nginx/服务器配置了 SPA fallback：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## 监控与日志

### 前端日志

应用使用 `console.error` 记录错误，可在浏览器开发者工具中查看。

### 健康检查

建议配置简单的健康检查端点（如部署为独立服务）：

```bash
# 检查服务是否响应
curl -I https://chat.example.com
```

## 更新部署

### 标准更新流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如有更新）
npm install

# 3. 构建
npm run build

# 4. 部署（根据部署方式选择）
# - Gateway 静态文件: 复制 out/ 到 Gateway 目录
# - Nginx: 复制到 /var/www/openclaw-chat/
# - Vercel/Netlify: 自动部署
```

### 回滚

```bash
# 回滚到上一个版本
git checkout HEAD~1
npm run build
# 重新部署
```
