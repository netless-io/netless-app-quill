import type { NetlessApp } from '@netless/fastboard'

import katex from 'katex'
import { QuillEditor } from './QuillEditor'
import type { QuillOptions } from 'quill';


export interface QuillAppAttributes {
  /**
   * Placeholder text to display when the editor is empty
   * @default ""
   */
  placeholder?: string;
}

export interface QuillAppOptions {
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

export const NetlessAppQuill: NetlessApp<QuillAppAttributes, {}, QuillAppOptions, QuillEditor> = {
  kind: 'Quill',
  setup(context) {
    // quill need this
    if (!globalThis.katex) {
      globalThis.katex = katex
    }

    const editor = new QuillEditor(context)

    context.emitter.on('destroy', () => {
      editor.destroy()
    })

    return editor
  }
}
