# @netless/netless-app-quill

基于 Quill.js 和 Y.js 构建的 Netless 白板协作富文本编辑器应用。

## 功能特性

- **实时协作**: 多用户可以同时编辑同一文档
- **富文本编辑**: 功能完整的文本编辑器，支持多种格式化选项
- **实时光标**: 实时显示其他用户的光标位置
- **图片上传**: 支持粘贴和上传图片
- **数学公式**: 内置 KaTeX 支持，可插入数学表达式
- **自定义工具栏**: 可配置的工具栏，包含各种格式化选项
- **占位符文本**: 可自定义空编辑器时显示的占位符文本
- **Base64 图片处理**: 自动将 base64 图片转换为 URL

## 安装

```bash
npm install @netless/app-quill
# 或
yarn add @netless/app-quill
# 或
pnpm add @netless/app-quill
```

## 使用方法

### 基础用法

```typescript
import { NetlessAppQuill } from '@netless/app-quill';
import { WindowManager } from '@netless/window-manager';

// 注册应用
await WindowManager.register({
  kind: 'Quill',
  src: NetlessAppQuill,
  appOptions: {
    options: {
      // Quill.js 配置选项
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          ['link', 'formula'],
          ['clean']
        ]
      }
    }
  }
});

// 添加新的 Quill 应用实例
manager.addApp({
  kind: 'Quill',
  attributes: {
    placeholder: '开始输入...'
  }
});
```

### 高级配置

```typescript
await WindowManager.register({
  kind: 'Quill',
  src: NetlessAppQuill,
  appOptions: {
    options: {
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, false] }, 'blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }, { align: [] }],
          [{ script: 'sub' }, { script: 'super' }],
          ['link', 'formula'],
          ['clean']
        ],
        history: {
          userOnly: true
        }
      }
    },
    uploadBase64Image: async (base64Image: string) => {
      // 将 base64 转换为文件并上传到服务器
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ image: base64Image })
      });
      const { url } = await response.json();
      return url;
    }
  }
});
```

## API 参考

### QuillAppAttributes

```typescript
interface QuillAppAttributes {
  /**
   * 编辑器为空时显示的占位符文本
   * @default ""
   */
  placeholder?: string;
}
```

### QuillAppOptions

```typescript
interface QuillAppOptions {
  /**
   * 初始化 Quill 实例的选项
   */
  options?: QuillOptions;
  
  /**
   * 将 base64 图片上传到图片服务器并返回图片 URL
   * @param base64Image 
   * @returns 图片 URL
   */
  uploadBase64Image?: (base64Image: string) => Promise<string>;
}
```

## 默认配置

应用提供了合理的默认配置：

- **工具栏**: 包含常用的格式化选项，如粗体、斜体、列表、链接和公式
- **光标**: 默认启用，支持实时协作
- **历史记录**: 仅用户历史记录，避免冲突
- **主题**: Snow 主题，提供简洁的外观
- **占位符**: 默认占位符文本为 "Hello, world!"

## 依赖项

- **@netless/fastboard**: ^0.3.16 (对等依赖)
- **quill**: ^2.0.2
- **quill-cursors**: ^4.0.3
- **y-quill**: ^1.0.0
- **yjs**: ^13.6.18
- **katex**: ^0.16.11

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建项目
pnpm build
```

## 示例

查看 `example/` 目录获取完整的工作示例。

## 许可证

MIT
