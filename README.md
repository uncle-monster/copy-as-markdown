# Copy as Markdown

一个 Chrome 浏览器扩展，可以在复制网页内容时自动转换为 Markdown 格式，并完整保留数学公式。

## ✨ 功能特性

- 🔄 **自动转换**：复制时自动将 HTML 转换为 Markdown
- 📐 **数学公式支持**：完整保留 KaTeX、MathJax、MathML 等格式的数学公式
- 📊 **表格支持**：HTML 表格自动转换为 Markdown 表格
- 💻 **代码块**：保留代码块及语法高亮语言标识
- 🖼️ **图片保留**：自动转换为 Markdown 图片语法
- ⚙️ **可配置**：支持自定义公式分隔符和其他选项

## 🌐 支持的网站

- Wikipedia（维基百科）
- Notion
- Stack Overflow / Stack Exchange
- 学术论文网站（带 MathJax/KaTeX）
- 大多数带有数学公式的网页

## 📦 安装方法

### 开发者模式安装

1. 下载或克隆此仓库
2. 下载 Turndown 库到 `lib/turndown.js`
   ```bash
   curl -o lib/turndown.js https://unpkg.com/turndown/dist/turndown.js
   ```
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启右上角「开发者模式」
5. 点击「加载已解压的扩展程序」
6. 选择项目文件夹

## 🔧 配置选项

点击扩展图标可以配置：

| 选项 | 说明 |
|------|------|
| 启用扩展 | 是否启用自动转换功能 |
| 行内公式分隔符 | `$...$` 或 `\(...\)` |
| 块级公式分隔符 | `$$...$$` 或 `\[...\]` |
| 保留图片 | 是否转换图片为 Markdown 语法 |
| 保留表格 | 是否转换表格为 Markdown 语法 |

## 📝 使用示例

复制包含公式的内容后，剪贴板中将自动包含 Markdown 格式：

**原始 HTML：**
```html
<p>根据勾股定理，<span class="katex">a² + b² = c²</span></p>
```

**转换后：**
```markdown
根据勾股定理，$a² + b² = c²$
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License