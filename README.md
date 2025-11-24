# Ubuntu Web 笔记应用 · 项目思路（项目.md）

## 1. 项目目标

在 Ubuntu 服务器上部署一个**轻量级、单机运行、无数据库依赖**的 Web 笔记应用：

- 通过浏览器访问 `http://服务器IP:7056` 直接进入前端界面；
- 适合作为**个人/小团队知识库**或**服务器运维日志**工具；
- 安装简单，仅依赖系统已有环境（Python）和少量三方库。

---

## 2. 核心需求梳理

### 2.1 功能需求

1. **笔记管理**
   - 新建笔记（标题 + 正文，正文支持 Markdown）
   - 编辑笔记
   - 删除笔记
   - 笔记按更新时间/创建时间排序
   - 笔记支持简单标签（可选）

2. **查看 & 搜索**
   - 左侧笔记列表，右侧编辑/预览区域（经典两栏布局）
   - 支持按标题关键字搜索
   - 支持标签筛选（如果开启标签功能）
   - 支持 Markdown 预览（前端渲染）

3. **安全（简单版）**
   - 单用户应用，支持**可选**登录密码（配置文件中设置）
   - 无需复杂用户体系，避免引入数据库

4. **配置**
   - 允许在配置文件中设置：
     - 数据存储目录（默认：`./data`）
     - 监听端口（默认：7056）
     - 管理密码（可为空表示无需登录）

---

### 2.2 非功能需求

- **无数据库**：所有数据以文件形式落盘，方便迁移和备份（打包整个目录即可）。
- **易部署**
  - `git clone` + `pip install -r requirements.txt` + `python main.py` 即可跑起来
  - 可选 systemd service 方式守护进程
- **资源占用小**
  - 适配低配 VPS / 家用 NAS 等场景
- **可扩展**
  - 未来可添加附件上传、导出、备份等功能，而不破坏现有结构

---

## 3. 技术选型

### 3.1 后端

**语言**：Python 3.10+（Ubuntu 普遍易安装）

**框架**：FastAPI（主要优势）  
- 开发 REST API 简洁、类型友好；
- 自带交互式接口文档（/docs）有利调试；
- 与 Uvicorn 配合性能和部署体验都不错。

> 备用方案：Flask。若更熟悉 Flask，可以同结构替换 FastAPI 的实现。

**Web 服务器**：
- 开发环境：直接 `uvicorn main:app --port 7056` 运行
- 生产环境：
  - 简单场景：直接用 Uvicorn 前台 / tmux / screen
  - 稍专业：Uvicorn + systemd（可选 Nginx 做反向代理，但非必须）

---

### 3.2 前端

**基本原则**：不引入复杂打包链路，**静态文件直接由后端服务**。

- 方案一（推荐）：**原生 HTML + CSS + 原生 JS + fetch**  
  - 单个 `index.html` 做 SPA 风格；
  - 使用 Fetch 调用 `/api/...` 接口；
  - 使用一个轻量级的浏览器端 Markdown 渲染库（如 marked.js）直接用 `<script>` 引入。

- 布局结构（大致）：
  - 顶部：应用标题 + 搜索框 + 新建按钮
  - 左侧：笔记列表（标题 + 更新时间）
  - 右侧：编辑区域（上编辑，下预览；或 Tab 切换“编辑/预览”）

---

### 3.3 数据存储方式（无数据库）

**存储目录结构（建议）**：

~~~text
data/
  config.json        # 一些运行时信息（可选）
  notes/
    20250101-xxxx.json
    20250102-yyyy.json
    ...
  index.json         # 可选：用于加速列表和搜索
~~~

**单条笔记 JSON 结构示例**：

~~~json
{
  "id": "20250101-xxxx",
  "title": "这是一个示例笔记",
  "content": "# 标题\n这里是正文，支持 Markdown。",
  "tags": ["工作", "随记"],
  "created_at": "2025-01-01T10:00:00",
  "updated_at": "2025-01-01T10:30:00"
}
~~~

说明：

- 每条笔记一个 `.json` 文件，方便备份、git 管理等；
- `id` 可使用时间前缀 + 短随机串，保证文件名基本有序；
- 搜索可以走**简单实现**：
  - 标题搜索：遍历文件，匹配标题（数据量不大时够用）；
  - 若数据量大，可维护 `index.json` 作为缓存索引（记录 id、title、tags、更新时间等）。

---

## 4. API 接口设计（草案）

统一前缀：`/api`

### 4.1 笔记相关

1. `GET /api/notes`
   - 功能：获取笔记列表
   - 查询参数：
     - `q`（可选）：标题关键词
     - `tag`（可选）：标签过滤
   - 返回字段：`[{id, title, tags, updated_at, created_at}, ...]`

2. `GET /api/notes/{note_id}`
   - 功能：获取某一条笔记详情
   - 返回：完整 JSON（包含 content）

3. `POST /api/notes`
   - 功能：新建笔记
   - 请求体：`{title, content, tags?}`
   - 返回：新建的笔记完整信息

4. `PUT /api/notes/{note_id}`
   - 功能：更新笔记
   - 请求体：`{title, content, tags?}`
   - 返回：更新后的笔记信息

5. `DELETE /api/notes/{note_id}`
   - 功能：删除笔记

### 4.2 认证（简单版，可选）

1. `POST /api/login`
   - 请求体：`{password}`
   - 校验通过则在响应中设置一个简单的 session cookie（如 HTTP-only 的 token）

2. 其它受保护接口校验该 cookie（后端可写一个简单的中间件）。

> 如果不需要密码保护，可以初期直接去掉这部分设计。

---

## 5. 前端页面结构（示意）

- `GET /` → 直接返回 `index.html`
- `static/` 目录用于存放：
  - `index.html`
  - `main.js`
  - `styles.css`
  - `marked.min.js` 等第三方库

### 5.1 页面主要区域

1. **顶部栏**
   - 应用标题（例如“Server Notes”）
   - 搜索输入框（输入即触发搜索）
   - “新建笔记”按钮
   - （可选）登录/登出入口

2. **左侧：笔记列表**
   - 滚动列表
   - 每项展示：
     - 标题
     - 更新时间（简短格式）
   - 支持点击选中，加载右侧编辑区域

3. **右侧：编辑 + 预览**
   - 标题输入框
   - 标签输入（简单逗号分隔即可）
   - 正文编辑 `textarea` 或 contenteditable 区域
   - Markdown 预览区（用 marked.js 渲染）
   - “保存”按钮、“删除”按钮

---

## 6. 项目目录结构（建议）

~~~text
project-root/
  main.py             # FastAPI 入口
  config.py           # 配置项（端口、数据目录、密码等）
  storage.py          # 读写文件封装
  api/
    __init__.py
    notes.py          # 笔记增删改查接口
    auth.py           # 登录逻辑（可选）
  web/
    static/
      index.html
      main.js
      styles.css
      marked.min.js   # Markdown 渲染库（也可 CDN）
  data/
    notes/            # 运行后自动创建
    index.json        # 可选索引文件
  requirements.txt
  README.md
  项目.md             # 本文件
~~~

---

## 7. 运行与部署方案（Ubuntu）

### 7.1 开发/测试启动

1. 安装依赖（示例）：

~~~bash
pip install fastapi uvicorn[standard] python-multipart
~~~

2. 运行：

~~~bash
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 7056
~~~

3. 浏览器中访问：

~~~text
http://服务器IP:7056
~~~

自动进入 `index.html` 界面。

### 7.2 systemd 守护（简单示例思路）

- 新建 `/etc/systemd/system/server-notes.service`
- ExecStart 指向 `uvicorn main:app --host 0.0.0.0 --port 7056`
- `systemctl enable --now server-notes`  
便于服务器重启后自动拉起。

---

## 8. 配置设计（简单）

`config.py` 内部使用一个简单对象或字典：

~~~python
APP_CONFIG = {
    "HOST": "0.0.0.0",
    "PORT": 7056,
    "DATA_DIR": "./data",
    "ADMIN_PASSWORD": "",  # 为空则表示不启用登录
}
~~~

后续可以支持从环境变量读取，方便 Docker / 不同环境部署。

---

## 9. 后续可扩展方向（TODO）

- 支持文件夹 / Notebook 分组（如“工作”、“生活”）
- 支持笔记的导出 / 导入（zip / json）
- 支持附件上传（图片、PDF），并在 Markdown 中引用
- 支持夜间模式 / 主题切换
- 添加简单的版本管理（每次保存保留一个历史版本）
- 提供备份命令（例如压缩 `data` 目录）

---

## 10. 小结

本项目定位为：**无数据库、文件存储、可在 Ubuntu 上一键启动的个人 Web 笔记应用**。  
技术栈简洁、部署简单，核心就是：

- FastAPI + Uvicorn 提供 REST API & 静态资源；
- 前端为单页面 + 原生 JS 调用接口；
- 所有数据都落在 `data/` 目录，以 JSON 文件形式存储；
- 默认监听 `7056` 端口，访问即进入 UI。

> 下一步：可以根据本思路直接开始写 `main.py`、`storage.py` 和一个最简 `index.html`，先打通“新建 → 保存 → 列表 → 查看”整条链路，再慢慢完善 UI 和其它功能。
