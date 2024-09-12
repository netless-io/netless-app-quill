import type { NetlessApp } from '@netless/fastboard'

import katex from 'katex'
import { QuillEditor } from './QuillEditor'

export const NetlessAppQuill: NetlessApp = {
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
