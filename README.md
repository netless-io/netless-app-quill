# @netless/netless-app-quill

A collaborative rich text editor app for Netless Whiteboard, built with Quill.js and Y.js for real-time collaboration.

## Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Rich Text Editing**: Full-featured text editor with formatting options
- **Live Cursors**: See other users' cursors in real-time
- **Image Upload**: Support for pasting and uploading images
- **Mathematical Formulas**: Built-in KaTeX support for mathematical expressions
- **Customizable Toolbar**: Configurable toolbar with various formatting options
- **Placeholder Text**: Customizable placeholder text for empty editor
- **Base64 Image Handling**: Automatic conversion of base64 images to URLs

## Installation

```bash
npm install @netless/app-quill
# or
yarn add @netless/app-quill
# or
pnpm add @netless/app-quill
```

## Usage

### Basic Usage

```typescript
import { NetlessAppQuill } from '@netless/app-quill';
import { WindowManager } from '@netless/window-manager';

// Register the app
await WindowManager.register({
  kind: 'Quill',
  src: NetlessAppQuill,
  appOptions: {
    options: {
      // Quill.js options
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

// Add a new Quill app instance
manager.addApp({
  kind: 'Quill',
  attributes: {
    placeholder: 'Start typing...'
  }
});
```

### Advanced Configuration

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
      // Convert base64 to file and upload to your server
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

## API Reference

### QuillAppAttributes

```typescript
interface QuillAppAttributes {
  /**
   * Placeholder text to display when the editor is empty
   * @default ""
   */
  placeholder?: string;
}
```

### QuillAppOptions

```typescript
interface QuillAppOptions {
  /**
   * Options for initializing a Quill instance
   */
  options?: QuillOptions;
  
  /**
   * Upload the base64 image to the image server and return the image url
   * @param base64Image 
   * @returns image url
   */
  uploadBase64Image?: (base64Image: string) => Promise<string>;
}
```

## Default Configuration

The app comes with sensible defaults:

- **Toolbar**: Includes common formatting options like bold, italic, lists, links, and formulas
- **Cursors**: Enabled by default for real-time collaboration
- **History**: User-only history to prevent conflicts
- **Theme**: Snow theme for a clean look
- **Placeholder**: "Hello, world!" as default placeholder text

## Dependencies

- **@netless/fastboard**: ^0.3.16 (peer dependency)
- **quill**: ^2.0.2
- **quill-cursors**: ^4.0.3
- **y-quill**: ^1.0.0
- **yjs**: ^13.6.18
- **katex**: ^0.16.11

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build the project
pnpm build
```

## Example

See the `example/` directory for a complete working example.

## License

MIT
