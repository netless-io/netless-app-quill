import type IQuillRange from "quill-cursors/dist/quill-cursors/i-range";

import type { RoomState } from "@netless/fastboard";

import * as Y from "yjs";

import Quill from "quill";
import QuillCursors from "quill-cursors";
import { QuillBinding } from "y-quill";
import { disposableStore } from "@wopjs/disposable";

import { connect, createVector, type AppContext, type Vector } from "./yjs-binding";
import { add_class, color_to_string, element, next_tick } from "./internal";
import styles from "./style.scss?inline";

Quill.register("modules/cursors", QuillCursors);

export class QuillEditor {
  static readonly styles = styles;

  readonly editor: Quill;
  readonly cursors: QuillCursors;

  readonly yDoc: Y.Doc;
  readonly yText: Y.Text;
  readonly yBinding: QuillBinding;

  readonly $container: HTMLDivElement;
  readonly $editor: HTMLDivElement;

  readonly vector: Vector;
  readonly dispose = disposableStore();

  constructor(readonly context: AppContext) {
    this.vector = createVector(context, "quill");
    this.dispose.add(this.vector.destroy.bind(this.vector));

    this.yDoc = new Y.Doc();
    this.yText = this.yDoc.getText("quill");
    this.dispose.add(connect(this.vector, this.yDoc));

    this.$container = add_class(element("div"), "container");
    this.$editor = add_class(element("div"), "editor");
    this.$container.appendChild(this.$editor);

    context.getBox().mountStyles(QuillEditor.styles);
    context.getBox().mountContent(this.$container);

    this.editor = new Quill(this.$editor, {
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, false] }, "blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }, { align: [] }],
          [{ script: "sub" }, { script: "super" }],
          ["link", "formula"],
          ["clean"],
        ],
        history: {
          userOnly: true,
        },
      },
      placeholder: "Hello, world!",
      theme: "snow",
      readOnly: !context.getIsWritable(),
    });

    this.cursors = this.editor.getModule("cursors") as QuillCursors;

    this.yBinding = new QuillBinding(this.yText, this.editor);

    setup_sync_handlers(this);
  }

  destroy() {
    this.yBinding.destroy();
    if (this.$container.parentElement) {
      this.$container.remove();
    }
  }
}

type UserCursor = { anchor: Y.RelativePosition; head: Y.RelativePosition };
type UserInfo = { name?: string; color?: string };

function setup_sync_handlers({
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

  const cursors$$ = context.createStorage<{ [uid: string]: UserCursor | null }>("cursors", {});
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
