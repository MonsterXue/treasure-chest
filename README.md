# 百宝箱

一个面向日常开发和网页调试场景的轻量浏览器工具箱，基于 WXT、Vue 3 和 TypeScript 构建。

## 功能

### 媒体拾取

- 从插件首页一键进入拾取模式。
- 根据鼠标坐标获取页面中的元素命中栈，可以识别被同级元素覆盖的媒体。
- 支持图片、视频、音频、SVG 图片、CSS 背景图和遮罩图地址。
- 点击页面锁定候选，使用 `Tab`、方向键或浮层按钮切换媒体地址。
- 支持复制当前媒体地址、重新选择以及按 `Esc` 退出。

暂不处理跨域 iframe、关闭的 Shadow DOM、Canvas 和 WebGL 等特殊情况。

### Cookie 管理

- 查看当前页面的 Cookie。
- 使用完整 Cookie 文本添加 Cookie。
- 复制或删除指定 Cookie。

### 二维码

- 检测当前页面图片中的二维码。
- 鼠标悬停图片时识别二维码内容。
- 复制识别结果或下载二维码图片。

## 本地开发

```bash
pnpm install
pnpm dev
```

类型检查和生产构建：

```bash
pnpm compile
pnpm build
```

构建产物位于 `.output/chrome-mv3`，可以在 Chrome 扩展程序页面中通过“加载已解压的扩展程序”进行安装。

扩展重新构建或重新加载后，已经打开的网页需要刷新一次，以重新注入最新的内容脚本。

## 图标

扩展图标位于 `public/icon`，使用以下命名：

```text
icon-16.png
icon-32.png
icon-48.png
icon-96.png
icon-128.png
```

## 权限

- `cookies`：读取和修改当前页面的 Cookie。
- `tabs`：获取当前活动页面，并向页面发送工具指令。
- `<all_urls>`：在网页中运行二维码识别、消息提示和媒体拾取功能。
