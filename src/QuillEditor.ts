import type IQuillRange from "quill-cursors/dist/quill-cursors/i-range";

import type { RoomState } from "@netless/fastboard";

import * as Y from "yjs";

import Quill, { type QuillOptions } from "quill";
import QuillCursors from "quill-cursors";
import { QuillBinding } from "y-quill";
import { disposableStore } from "@wopjs/disposable";

import { connect, createVector, type AnyDict, type AppContext, type Vector } from "./yjs-binding";
import { add_class, color_to_string, element, next_tick } from "./internal";
import styles from "./style.scss?inline";
import { DEFAULT_OPTIONS } from "./const";

export type Storage = AppContext['storage']

Quill.register("modules/cursors", QuillCursors);

export class QuillEditor {
  static readonly styles = styles;

  editor: Quill;
  cursors: QuillCursors;

  yDoc: Y.Doc;
  yText: Y.Text;
  yBinding: QuillBinding;

  $container: HTMLDivElement;
  $editor: HTMLDivElement;

  vector: Vector;
  dispose = disposableStore();
  isWritable:boolean;
  cursors$$: Storage;
  storage$$: Storage;
  options: QuillOptions;

  constructor(readonly context: AppContext) {
    this.isWritable = context.getIsWritable();
    this.init(context).then(() => {
      this.vector = createVector(context, this.storage$$);
      this.dispose.add(this.vector.destroy.bind(this.vector));
  
      this.yDoc = new Y.Doc();
      this.yText = this.yDoc.getText("quill");
      this.dispose.add(connect(this.vector, this.yDoc));
  
      this.$container = add_class(element("div"), "container");
      this.$editor = add_class(element("div"), "editor");
      this.$container.appendChild(this.$editor);
  
      context.getBox().mountStyles(QuillEditor.styles);
      context.getBox().mountContent(this.$container);

      const options = context.getAppOptions()?.options || {};

      this.options = {
        ...DEFAULT_OPTIONS,
        ...options,
        readOnly: !this.isWritable,
        // 禁用 Quill 的默认粘贴处理
        clipboard: {
          matchVisual: false,
        },
      }
      
      const attributes = context.getAttributes();
      if(attributes.placeholder){
        this.options.placeholder = attributes.placeholder;
      }
  
      this.editor = new Quill(this.$editor, this.options);

      // 使用 capture 阶段来确保我们的处理在 Quill 之前执行
      this.editor.root.addEventListener('paste', async (e) => {
        // 立即阻止默认行为
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();

        const clipboardData = e.clipboardData || (window as any).clipboardData;
        
        const html = clipboardData.getData('text/html') || clipboardData.getData('text/plain');

        if (!html) {
          // 检查是否有图片文件
          const files = Array.from(clipboardData.files || []) as File[];
          const imageFiles = files.filter((file: File) => file.type.startsWith('image/'));
          
          if (imageFiles.length > 0) {
            // 处理粘贴的图片文件
            await this.handlePastedImageFiles(imageFiles);
          }
          return false;
        }
      
        const processedHTML = await this.handleBase64ImagesInHTML(html);

        const range = this.editor.getSelection(true);
        if (range) {
          // 使用 clipboard.convert 转成 Delta
          const delta = this.editor.clipboard.convert({ html: processedHTML });
          // 先删空当前选区（如果有）
          this.editor.deleteText(range.index, range.length);
      
          // 直接使用 dangerouslyPasteHTML 插入处理后的 HTML 内容
          this.editor.clipboard.dangerouslyPasteHTML(range.index, processedHTML, 'user');
      
          // 计算正确的插入长度
          let insertLength = 0;
          if (delta.ops && delta.ops.length > 0) {
            // 遍历所有操作来计算总长度
            delta.ops.forEach(op => {
              if (typeof op.insert === 'string') {
                insertLength += op.insert.length;
              } else if (typeof op.insert === 'object') {
                // 对于图片、视频等嵌入内容，长度为 1
                insertLength += 1;
              }
            });
          }
          
          // 设置光标到插入末尾
          this.editor.setSelection(range.index + insertLength, 0);
        }
        
        return false; // 确保事件不会继续传播
      }, true); // 使用 capture 阶段

      // 添加 drop 事件处理，支持拖拽图片文件
      this.editor.root.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);

      this.editor.root.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer?.files || []) as File[];
        const imageFiles = files.filter((file: File) => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          // 计算拖拽位置对应的编辑器位置
          const range = this.getDropRange(e);
          if (range) {
            await this.handleDroppedImageFiles(imageFiles, range);
          }
        }
        
        return false;
      }, true);

      this.cursors = this.editor.getModule("cursors") as QuillCursors;
  
      this.yBinding = new QuillBinding(this.yText, this.editor);
      setup_sync_handlers(this);
    });
  }

  private async handleBase64ImagesInHTML(html: string): Promise<string> {
    const div = document.createElement('div');
    div.innerHTML = html;
  
    // 收集所有需要处理的 base64 图
    const uploadTasks: Promise<void>[] = [];

    const uploadBase64Image = this.context.getAppOptions()?.uploadBase64Image;
  
    // 处理 <img src="data:image/...">
    const imgElements = Array.from(div.querySelectorAll('img'));
    
    for (const img of imgElements) {
      const src = img.getAttribute('src');
      if (src && src.startsWith('data:image')) {
        if (uploadBase64Image) {
          const task = this.context.getAppOptions().uploadBase64Image(src).then((url) => {
            img.setAttribute('src', url);
          }).catch((err) => {
            console.error('图片上传失败:', err);
            img.remove();
          });
          uploadTasks.push(task);
        } else {
          console.warn('uploadBase64Image is not set, so the image will be removed');
          img.remove();
        }
      }
    }
  
    // 处理 style 中的 background-image: url(data:image/...)
    const allElements = Array.from(div.querySelectorAll<HTMLElement>('*'));
    for (const el of allElements) {
      const bg = el.style.backgroundImage;
      const match = bg && bg.match(/url\(["']?(data:image\/[^"')]+)["']?\)/);
      if (match) {
        if (uploadBase64Image) {
          const base64 = match[1];
          const task = this.context.getAppOptions().uploadBase64Image(base64).then((url) => {
              el.style.backgroundImage = `url("${url}")`;
            }).catch((err) => {
            console.error('背景图上传失败:', err);
            el.style.backgroundImage = '';
          });
          uploadTasks.push(task);
        } else {
          console.warn('uploadBase64Image is not set, so the backgroundImage will be removed');
          el.style.backgroundImage = '';
        }
      }
    }
    await Promise.all(uploadTasks);
    const result = div.innerHTML;
    return result;
  }

  private async handlePastedImageFiles(imageFiles: File[]): Promise<void> {
    const uploadBase64Image = this.context.getAppOptions()?.uploadBase64Image;
    
    if (!uploadBase64Image) {
      console.warn('uploadBase64Image is not set, cannot upload pasted images');
      return;
    }

    const range = this.editor.getSelection(true);
    if (!range) return;

    // 为每个图片文件创建上传任务
    const uploadTasks = imageFiles.map(async (file, index) => {
      try {
        // 将文件转换为 base64
        const base64 = await this.fileToBase64(file);
        
        // 上传图片
        const url = await uploadBase64Image(base64);
        
        // 插入图片到编辑器
        const insertIndex = range.index + index;
        this.editor.insertEmbed(insertIndex, 'image', url, 'user');
        
        // 如果不是最后一个图片，在图片后插入换行
        if (index < imageFiles.length - 1) {
          this.editor.insertText(insertIndex + 1, '\n', 'user');
        }
        
      } catch (err) {
        console.error('图片上传失败:', err);
      }
    });

    await Promise.all(uploadTasks);
    
    // 设置光标到最后一个图片之后
    const finalIndex = range.index + imageFiles.length;
    this.editor.setSelection(finalIndex, 0);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private getDropRange(e: DragEvent): { index: number; length: number } | null {
    // 获取拖拽位置对应的编辑器位置
    const rect = this.editor.root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 创建临时选区来获取位置
    const range = document.createRange();
    const selection = window.getSelection();
    
    // 尝试在拖拽位置创建选区
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element && this.editor.root.contains(element)) {
      // 如果拖拽位置在编辑器内，使用当前选区或文档末尾
      const currentSelection = this.editor.getSelection();
      if (currentSelection) {
        return currentSelection;
      }
    }
    
    // 默认使用文档末尾
    const length = this.editor.getLength();
    return { index: length - 1, length: 0 };
  }

  private async handleDroppedImageFiles(imageFiles: File[], range: { index: number; length: number }): Promise<void> {
    const uploadBase64Image = this.context.getAppOptions()?.uploadBase64Image;
    
    if (!uploadBase64Image) {
      console.warn('uploadBase64Image is not set, cannot upload dropped images');
      return;
    }

    // 为每个图片文件创建上传任务
    const uploadTasks = imageFiles.map(async (file, index) => {
      try {
        // 将文件转换为 base64
        const base64 = await this.fileToBase64(file);
        
        // 上传图片
        const url = await uploadBase64Image(base64);
        
        // 插入图片到编辑器
        const insertIndex = range.index + index;
        this.editor.insertEmbed(insertIndex, 'image', url, 'user');
        
        // 如果不是最后一个图片，在图片后插入换行
        if (index < imageFiles.length - 1) {
          this.editor.insertText(insertIndex + 1, '\n', 'user');
        }
        
      } catch (err) {
        console.error('图片上传失败:', err);
      }
    });

    await Promise.all(uploadTasks);
    
    // 设置光标到最后一个图片之后
    const finalIndex = range.index + imageFiles.length;
    this.editor.setSelection(finalIndex, 0);
  }

  async init(context: AppContext){
    const isCheck = !this.isWritable && !Object.keys(context.getAttributes()).length;
    if (isCheck) {
      await context.getRoom()?.setWritable(true);
    }
    this.storage$$ = context.createStorage<AnyDict>(`${this.context.appId}-storage`, {});
    this.cursors$$ = context.createStorage<{ [uid: string]: UserCursor | null }>(`${this.context.appId}-cursors`, {});
    if (isCheck) {
      await context.getRoom()?.setWritable(false);
    }
  }

  destroy() {
    this.yBinding.destroy();
    if (this.$container.parentElement) {
      this.$container.remove();
      this.cursors$$.destroy();
      this.storage$$.destroy();
    }
  }
}

type UserCursor = { anchor: Y.RelativePosition; head: Y.RelativePosition };
type UserInfo = { name?: string; color?: string };

function setup_sync_handlers({
  cursors$$,
  dispose,
  context,
  editor,
  cursors,
  yDoc: doc,
  yText: type,
}: QuillEditor) {
  const ME = context.getRoom()?.uid || "";

  dispose.add(
    context.emitter.on("writableChange", () => {
      context.getIsWritable() ? editor.enable() : editor.disable();
    })
  );

  // #region Cursors

  // const cursors$$ = context.createStorage<{ [uid: string]: UserCursor | null }>("cursors", {});
  const timers = new Map<string, number>();

  const refreshCursors = () => {
    Object.keys(cursors$$.state).forEach(uid => {
      if (uid === ME) {
        return update_cursor(cursors, null, uid, doc, type, timers);
      }
      const cursor = cursors$$.state[uid];
      const member = context.getDisplayer().state.roomMembers.find(a => a.payload?.uid === uid);
      if (!member) {
        // setState() will trigger refreshCursors() synchronously, so we must schedule it to next tick.
        if (context.getIsWritable()) {
          next_tick().then(() => cursors$$.setState({ [uid]: undefined }));
        }
        return update_cursor(cursors, null, uid, doc, type, timers);
      }
      const user: UserInfo = {
        name: member.payload?.nickName,
        color: color_to_string(member.memberState.strokeColor),
      };
      update_cursor(cursors, { user, cursor }, uid, doc, type, timers);
    });
  };
  dispose.make(() => {
    const onSelectionChange = (_0: string, _1: unknown, _2: unknown, origin: string) => {
      const sel = editor.getSelection();
      // prevent incorrect cursor jumping https://github.com/yjs/y-quill/issues/14
      if (origin === "silent") return;
      if (sel === null) {
        context.getIsWritable() && cursors$$.setState({ [ME]: null });
      } else {
        const anchor = Y.createRelativePositionFromTypeIndex(type, sel.index);
        const head = Y.createRelativePositionFromTypeIndex(type, sel.index + sel.length);
        context.getIsWritable() && cursors$$.setState({ [ME]: { anchor, head } });
      }
      refreshCursors();
    };
    editor.on("editor-change", onSelectionChange);
    return () => editor.off("editor-change", onSelectionChange);
  });
  dispose.add(cursors$$.addStateChangedListener(refreshCursors));

  dispose.make(() => {
    const eventName = context.isReplay ? 'onPlayerStateChanged' : 'onRoomStateChanged'
    const listener = (state: Partial<RoomState>) => {
      if (state.roomMembers) refreshCursors();
    }
    context.getDisplayer().callbacks.on(eventName, listener)
    return () => context.getDisplayer().callbacks.off(eventName, listener)
  })

  // #endregion
}

interface CursorAware {
  cursor?: UserCursor | null;
  user?: UserInfo | null;
}

function update_cursor(
  cursors: QuillCursors,
  aw: CursorAware | null,
  uid: string,
  doc: Y.Doc,
  type: Y.Text,
  timers: Map<string, number>
) {
  try {
    if (aw && aw.cursor) {
      const user = aw.user || {};
      const color = user.color || "#ffa500";
      const name = user.name || `User: ${uid}`;
      const cursor = cursors.createCursor(uid, name, color);
      const anchor = Y.createAbsolutePositionFromRelativePosition(
        Y.createRelativePositionFromJSON(aw.cursor.anchor),
        doc
      );
      const head = Y.createAbsolutePositionFromRelativePosition(
        Y.createRelativePositionFromJSON(aw.cursor.head),
        doc
      );
      if (anchor && head && anchor.type === type) {
        const range: IQuillRange = {
          index: anchor.index,
          length: head.index - anchor.index,
        };
        if (
          !cursor.range ||
          range.index !== cursor.range.index ||
          range.length !== cursor.range.length
        ) {
          cursors.moveCursor(uid, range);
          let timer = timers.get(uid) || 0;
          if (timer) clearTimeout(timer);
          cursor.toggleFlag(true);
          timer = window.setTimeout(() => cursor.toggleFlag(false), 3000);
          timers.set(uid, timer);
        }
      }
    } else {
      cursors.removeCursor(uid);
    }
  } catch (err) {
    console.error(err);
  }
}
