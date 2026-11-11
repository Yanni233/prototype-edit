# HTML 原型编辑器插件

给单个、静态 HTML 原型增加“点击元素直接修改”的编辑能力。

## 快速开始

### 1. 准备目录

将整个 `prototype-editor` 文件夹复制到目标 HTML 所在目录：

    我的原型/
    ├── 原型.html
    └── prototype-editor/
        ├── prototype-editor.js
        ├── prototype-editor.css
        ├── prototype-editor-server.js
        └── README.md

使用“覆盖源文件”前，请确保电脑已安装 [Node.js](https://nodejs.org/)。

### 2. 接入

在目标 HTML 的 `head` 结束标签前加入：

    <link rel="stylesheet" href="./prototype-editor/prototype-editor.css">

在 body 结束标签前加入：

    <script src="./prototype-editor/prototype-editor.js"></script>
    <script>
      PrototypeEditor.init({
        exportFileName: '我的原型-编辑版.html'
      });
    </script>

### 3. 启动本地服务

在终端进入 **目标 HTML 所在目录**（不是 `prototype-editor` 子目录），运行：

    node ./prototype-editor/prototype-editor-server.js

再打开 `http://localhost:4173/原型.html`。右下角会出现“编辑原型”。端口被占用时可自行指定，例如：

    node ./prototype-editor/prototype-editor-server.js 4174

此时访问地址对应为 `http://localhost:4174/原型.html`。

## 当前支持

- 标题、段落、标签、按钮：直接修改文字、保存或删除。
- 链接：修改文字和跳转地址。
- 输入框：修改占位提示。
- 下拉框：修改选项名称和值，添加、删除选项，并设置默认选中项。
- 图片：替换本地图片；导出后图片会内嵌在 HTML 内。
- 表格：编辑单元格，添加/删除行、列，删除整张表。
- 全局：上一步、下一步、导出干净的最终 HTML（不含编辑器）。
- 本地保存：通过“覆盖源文件”直接保存当前 HTML；保存前会二次确认并自动备份。

## 保存方式

- **导出新 HTML**：生成不含编辑器的最终预览版，适合发送或交付；该文件不能再次进入编辑模式。
- **覆盖源文件**：覆盖当前打开的 HTML，适合持续编辑。每次覆盖前都会二次确认并在同目录创建备份，例如 `原型.backup-2026-11-11T13-56-49-757Z.html`。

需要恢复时，将备份文件改名为原文件名（如 `原型.html`）即可。

## 配置项

| 配置项 | 作用 | 默认值 |
| --- | --- | --- |
| exportFileName | 导出的文件名 | 原型-编辑版.html |
| allowDelete | 是否显示删除操作 | true |
| storageKey | 浏览器草稿的存储键 | 按当前页面路径生成 |
| saveServiceUrl | 直接使用 `file://` 打开页面时的本地保存服务地址 | `http://127.0.0.1:4173/...` |

示例：

    PrototypeEditor.init({
      exportFileName: '登录页-评审版.html',
      allowDelete: false
    });

## 使用限制

- 面向单页面、独立打开的静态 HTML 原型。
- 对动态渲染、复杂画布、iframe 内元素不保证可编辑。
- 本地保存服务仅允许读取、覆盖启动目录内的 HTML 文件；不要在包含敏感文件的上级目录启动它。
- 如果直接以 `file://` 方式打开 HTML，且服务端口不是 `4173`，初始化时指定服务地址：

    PrototypeEditor.init({
      saveServiceUrl: 'http://127.0.0.1:4174/__prototype-editor__/overwrite'
    });
