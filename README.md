# OpenClaw Chat

OpenClaw Gateway 的现代 Web 聊天 UI。

<!-- screenshot here -->

## 功能特性

- **实时聊天** - 通过 WebSocket 与 OpenClaw Gateway 进行实时通信
- **流式响应** - 支持 AI 响应的流式输出，实时显示生成内容
- **工具调用可视化** - 实时展示 AI 工具调用过程和结果
- **会话管理** - 创建、重命名、删除会话，支持会话搜索
- **模型选择** - 会话级别的 AI 模型切换
- **Markdown 渲染** - 支持代码高亮、GFM 语法
- **响应式设计** - 适配桌面和移动端
- **键盘快捷键** - Ctrl+K 搜索、Ctrl+N 新建会话、Escape 关闭侧边栏
- **深色主题** - 现代化深色 UI

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI**: React 19
- **样式**: Tailwind CSS 4
- **组件**: shadcn/ui
- **状态管理**: React Context + Hooks
- **通信**: WebSocket (OpenClaw Gateway Protocol v3)
- **图标**: Lucide React
- **Markdown**: react-markdown + remark-gfm + rehype-highlight

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/piggy-wanger/openclaw-chat.git
cd openclaw-chat
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 配置 Gateway URL

启动应用后，访问 http://localhost:3000，进入设置页面配置 Gateway URL：

```
ws://127.0.0.1:18789
```

## 开发指南

### 启动开发服务器

```bash
npm run dev
```

开发服务器将在 http://localhost:3000 启动。

### 连接 OpenClaw Gateway

1. 确保 OpenClaw Gateway 正在运行（默认端口 18789）
2. 打开应用设置页面
3. 输入 Gateway URL（如 `ws://127.0.0.1:18789`）
4. 如需认证，输入 Token
5. 点击"测试连接"验证配置
6. 保存设置

### 项目结构

```
openclaw-chat/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx           # 主聊天页面
│   ├── layout.tsx         # 根布局
│   ├── settings/          # 设置页面
│   └── api/               # API 路由（兼容层）
├── components/            # React 组件
│   ├── chat/              # 聊天相关组件
│   │   ├── ChatContainer.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── InputArea.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageList.tsx
│   │   ├── ToolCallCard.tsx
│   │   └── ToolCallList.tsx
│   ├── sidebar/           # 侧边栏组件
│   │   ├── SessionItem.tsx
│   │   ├── SessionList.tsx
│   │   └── Sidebar.tsx
│   ├── settings/          # 设置组件
│   │   └── SettingsForm.tsx
│   ├── ui/                # 基础 UI 组件 (shadcn)
│   └── Providers.tsx      # 全局 Provider
├── hooks/                 # React Hooks
│   ├── useChat.tsx        # 聊天逻辑
│   ├── useDraft.ts        # 草稿管理
│   ├── useGateway.tsx     # Gateway 连接
│   ├── useKeyboardShortcuts.tsx
│   ├── useSession.tsx     # 会话管理
│   └── useSettings.tsx    # 设置管理
├── lib/                   # 工具库
│   ├── api.ts             # API 请求工具
│   ├── gateway-types.ts   # Gateway 类型定义
│   └── types.ts           # 应用类型定义
├── db/                    # 数据库（兼容层）
│   ├── index.ts
│   └── schema.ts
├── docs/                  # 文档
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── PRD.md
│   ├── TASKS.md
│   ├── TECH-DESIGN.md
│   └── WORKFLOW.md
└── public/                # 静态资源
```

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |

## 部署指南

详细的部署说明请参阅 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

### 方式 1: Gateway 静态文件服务

将构建产物部署到 OpenClaw Gateway 的静态文件目录。

```bash
npm run build
# 将 out/ 目录内容复制到 Gateway 静态目录
```

### 方式 2: 独立 Nginx

```nginx
server {
    listen 80;
    server_name chat.example.com;

    location / {
        root /var/www/openclaw-chat;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket 代理（如需要）
    location /ws {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 方式 3: Vercel / Netlify

直接连接 GitHub 仓库，平台会自动检测 Next.js 并配置构建设置。

## 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式（不影响功能）
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具链相关

## License

[MIT](./LICENSE)

## 相关项目

- [OpenClaw Gateway](https://github.com/piggy-wanger/openclaw-gateway) - 后端 Gateway 服务
- [OpenClaw Control UI](https://github.com/piggy-wanger/openclaw-control) - 管理控制台
