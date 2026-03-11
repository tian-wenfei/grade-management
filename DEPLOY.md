# 成绩管理系统部署指南

## 部署到 Railway（推荐）

### 1. 准备工作
- 注册 [Railway](https://railway.app/) 账号
- 安装 Git

### 2. 初始化 Git 仓库
```bash
cd c:\Users\Lenovo\Desktop\成绩管理系统
git init
git add .
git commit -m "Initial commit"
```

### 3. 部署到 Railway
1. 登录 Railway Dashboard
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 连接你的 GitHub 仓库
4. Railway 会自动检测并部署

### 4. 配置环境变量（可选）
在 Railway 项目设置中添加：
- `NODE_ENV=production`
- `CORS_ORIGIN=你的域名`

## 部署到 Render

### 1. 准备工作
- 注册 [Render](https://render.com/) 账号
- 将代码推送到 GitHub

### 2. 创建 Web Service
1. 点击 "New" → "Web Service"
2. 连接 GitHub 仓库
3. 配置：
   - Name: grade-management
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

### 3. 持久化存储
Render 免费版文件系统不持久，建议：
1. 添加 Render Disk（付费）
2. 或使用外部数据库（PostgreSQL/MySQL）

## 本地运行

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问
http://localhost:3001
```

## 默认账号
- 用户名: admin
- 密码: 123456

## 项目结构
```
成绩管理系统/
├── backend/
│   ├── server.js          # 后端服务
│   ├── package.json       # 后端依赖
│   └── data/              # 数据库文件（生产环境）
├── index.html             # 前端页面
├── script.js              # 前端逻辑
├── style.css              # 样式文件
├── package.json           # 根依赖
├── Procfile               # Heroku/Railway 配置
└── .gitignore             # Git 忽略文件
```

## 注意事项
1. 生产环境数据库不会每次重置
2. 首次部署会自动创建 admin 账户
3. 请及时修改默认密码
