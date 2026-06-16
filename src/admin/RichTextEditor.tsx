import React, { useEffect, useRef, useState } from "react";
import { Button, Select, Tooltip, Upload } from "antd";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  BoldOutlined,
  FontSizeOutlined,
  OrderedListOutlined,
  PictureOutlined,
  RedoOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UnderlineOutlined
} from "@ant-design/icons";
import { imageToCompressedDataUrl } from "../shared/api";

type RichTextEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  onError?: (message: string) => void;
};

function textLength(element: HTMLElement | null) {
  return String(element?.innerText || "").trim().length;
}

export default function RichTextEditor({ value = "", onChange, maxLength = 5000, placeholder = "请输入内容...", onError }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  const sync = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setCount(textLength(editor));
    onChange?.(editor.innerHTML);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== (value || "")) {
      editor.innerHTML = value || "";
      setCount(textLength(editor));
    }
  }, [value]);

  const runCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    sync();
  };

  const uploadProps = {
    beforeUpload: async (file: File) => {
      try {
        const dataUrl = await imageToCompressedDataUrl(file);
        runCommand("insertImage", dataUrl);
      } catch (error: any) {
        onError?.(error.message);
      }
      return false;
    },
    showUploadList: false,
    accept: "image/*"
  };

  return (
    <div className="product-rich-editor">
      <div className="product-rich-toolbar">
        <Select
          className="product-rich-format"
          defaultValue="p"
          options={[
            { value: "p", label: "正文" },
            { value: "h2", label: "标题" },
            { value: "h3", label: "小标题" }
          ]}
          onChange={tag => runCommand("formatBlock", tag)}
        />
        <Tooltip title="加粗"><Button type="text" icon={<BoldOutlined />} onClick={() => runCommand("bold")} /></Tooltip>
        <Tooltip title="下划线"><Button type="text" icon={<UnderlineOutlined />} onClick={() => runCommand("underline")} /></Tooltip>
        <Tooltip title="斜体"><Button type="text" className="product-rich-italic" onClick={() => runCommand("italic")}>I</Button></Tooltip>
        <Select
          className="product-rich-size"
          suffixIcon={<FontSizeOutlined />}
          defaultValue="3"
          options={[
            { value: "2", label: "小号" },
            { value: "3", label: "默认字号" },
            { value: "4", label: "大号" },
            { value: "5", label: "特大" }
          ]}
          onChange={size => runCommand("fontSize", size)}
        />
        <Tooltip title="无序列表"><Button type="text" icon={<UnorderedListOutlined />} onClick={() => runCommand("insertUnorderedList")} /></Tooltip>
        <Tooltip title="有序列表"><Button type="text" icon={<OrderedListOutlined />} onClick={() => runCommand("insertOrderedList")} /></Tooltip>
        <Tooltip title="左对齐"><Button type="text" icon={<AlignLeftOutlined />} onClick={() => runCommand("justifyLeft")} /></Tooltip>
        <Tooltip title="居中"><Button type="text" icon={<AlignCenterOutlined />} onClick={() => runCommand("justifyCenter")} /></Tooltip>
        <Upload {...uploadProps}>
          <Tooltip title="上传图片"><Button type="text" icon={<PictureOutlined />} /></Tooltip>
        </Upload>
        <Tooltip title="撤销"><Button type="text" icon={<UndoOutlined />} onClick={() => runCommand("undo")} /></Tooltip>
        <Tooltip title="重做"><Button type="text" icon={<RedoOutlined />} onClick={() => runCommand("redo")} /></Tooltip>
        <Button type="text" onClick={() => runCommand("removeFormat")}>清除格式</Button>
      </div>
      <div
        ref={editorRef}
        className="product-rich-body"
        contentEditable
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={sync}
        onPaste={() => window.setTimeout(sync, 0)}
        suppressContentEditableWarning
      />
      <div className="product-rich-count">{count}/{maxLength}</div>
    </div>
  );
}
