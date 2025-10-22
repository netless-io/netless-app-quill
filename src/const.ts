import type { QuillOptions } from "quill";

declare let __VERSION__: string;
export const pkg_version = __VERSION__;

export const DEFAULT_OPTIONS: QuillOptions = {
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
    theme: "snow"
  }