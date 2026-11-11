# HTML 原型编辑器插件

给单个、静态 HTML 原型增加“点击元素直接修改”的编辑能力。

## 目录

    prototype-editor/
    ├── prototype-editor.js
    ├── prototype-editor.css
    └── README.md

## 接入

将 prototype-editor 文件夹复制到目标 HTML 所在目录，再在目标 HTML 的 head 结束标签前加入：

    <link rel="stylesheet" href="./prototype-editor/prototype-editor.css">

在 body 结束标签前加入：

    <script src="./prototype-editor/prototype-editor.js"></script>
    <script>
      PrototypeEditor.init({
        exportFileName: '我的原型-编辑版.html'
      });
    </script>

打开 HTML 后，右下角会出现“编辑原型”。

## 当前支持

- 标题、段落、标签、按钮：直接修改文字、保存或删除。
- 链接：修改文字和跳转地址。
- 输入框：修改占位提示。
- 图片：替换本地图片；导出后图片会内嵌在 HTML 内。
- 表格：编辑单元格，添加/删除行、列，删除整张表。
- 全局：上一步、下一步、导出新 HTML。

## 导出规则

导出的 HTML 会保存编辑记录，但仍通过相对路径引用插件资源。因此需要让导出的 HTML 与 prototype-editor 文件夹保持相对位置不变，例如：

    我的原型/
    ├── 原型.html
    ├── 我的原型-编辑版.html
    └── prototype-editor/

## 配置项

| 配置项 | 作用 | 默认值 |
| --- | --- | --- |
| exportFileName | 导出的文件名 | 原型-编辑版.html |
| allowDelete | 是否显示删除操作 | true |
| storageKey | 浏览器草稿的存储键 | 按当前页面路径生成 |

示例：

    PrototypeEditor.init({
      exportFileName: '登录页-评审版.html',
      allowDelete: false
    });

## 使用限制

- 面向单页面、独立打开的静态 HTML 原型。
- 导出功能生成新文件，不会覆盖原文件。
- 对动态渲染、复杂画布、iframe 内元素不保证可编辑。
- 若需覆盖本地 HTML 源文件，需要额外运行本地写入服务；插件本身不静默改写用户文件。
