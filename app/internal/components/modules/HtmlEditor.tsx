"use client";

import { useEffect, useState, useRef } from "react";

export interface HtmlEditorProps {
    initialHtml: string;
    onChange: (html: string) => void;
    height?: string;
}

export function HtmlEditor({ initialHtml, onChange, height = "600px" }: HtmlEditorProps) {
    const [value, setValue] = useState(initialHtml);
    const [mode, setMode] = useState<"visual" | "code">("visual");
    const editorRef = useRef<HTMLDivElement>(null);
    // Track the last initialHtml we actually applied so we only reset when the
    // template is intentionally switched (i.e. initialHtml changes from the
    // outside), not when the parent echoes back the value we just typed.
    const lastAppliedHtml = useRef(initialHtml);
    const isInternalChange = useRef(false);

    useEffect(() => {
        // Skip if this update was triggered by our own onChange callback
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }
        // Only reset the editor when the template actually switches
        if (initialHtml === lastAppliedHtml.current) return;
        lastAppliedHtml.current = initialHtml;
        setValue(initialHtml);
        if (mode === "visual" && editorRef.current) {
            editorRef.current.innerHTML = initialHtml;
        }
    }, [initialHtml]);

    useEffect(() => {
        if (mode === "visual" && editorRef.current && value) {
            editorRef.current.innerHTML = value;
        }
    }, [mode]);

    const handleContentChange = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            setValue(html);
            lastAppliedHtml.current = html;
            isInternalChange.current = true;
            onChange(html);
        }
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        lastAppliedHtml.current = newValue;
        isInternalChange.current = true;
        onChange(newValue);
        if (editorRef.current) {
            editorRef.current.innerHTML = newValue;
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const variable = e.dataTransfer.getData("text/plain");

        if (mode === "visual" && editorRef.current) {
            // Insert at drop position in visual mode
            editorRef.current.focus();

            // Get the drop position and create a range
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }

            // Insert the variable at the drop position
            document.execCommand("insertText", false, variable);
            handleContentChange();
        } else {
            // Insert at cursor position in code mode
            const textarea = e.target as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const newValue = text.substring(0, start) + variable + text.substring(end);
            setValue(newValue);
            onChange(newValue);

            // Set cursor position after the inserted variable
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + variable.length;
                textarea.focus();
            }, 0);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        handleContentChange();
    };

    const insertLink = () => {
        const url = prompt("Enter URL:");
        if (url) execCommand("createLink", url);
    };

    const insertImage = () => {
        const url = prompt("Enter image URL:");
        if (url) execCommand("insertImage", url);
    };

    return (
        <div className="html-editor-wrapper">

            <div className="editor-toolbar">
                <button type="button" onClick={() => setMode(mode === "visual" ? "code" : "visual")} className="mode-toggle">
                    {mode === "visual" ? "📝 Code" : "👁️ Visual"}
                </button>

                {mode === "visual" && (
                    <>
                        <div className="toolbar-divider"></div>
                        <select onChange={(e) => execCommand("formatBlock", e.target.value)} className="toolbar-select">
                            <option value="">- Format -</option>
                            <option value="p">Paragraph</option>
                            <option value="h1">Heading 1</option>
                            <option value="h2">Heading 2</option>
                            <option value="h3">Heading 3</option>
                            <option value="h4">Heading 4</option>
                            <option value="h5">Heading 5</option>
                            <option value="h6">Heading 6</option>
                        </select>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("bold")} title="Bold"><strong>B</strong></button>
                        <button type="button" onClick={() => execCommand("italic")} title="Italic"><em>I</em></button>
                        <button type="button" onClick={() => execCommand("underline")} title="Underline"><u>U</u></button>
                        <button type="button" onClick={() => execCommand("strikeThrough")} title="Strikethrough"><s>S</s></button>

                        <div className="toolbar-divider"></div>
                        <input
                            type="color"
                            onChange={(e) => execCommand("foreColor", e.target.value)}
                            title="Text Color"
                            className="color-picker"
                        />
                        <input
                            type="color"
                            onChange={(e) => execCommand("backColor", e.target.value)}
                            title="Background Color"
                            className="color-picker"
                        />

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("justifyLeft")} title="Align Left">⬅</button>
                        <button type="button" onClick={() => execCommand("justifyCenter")} title="Center">↔</button>
                        <button type="button" onClick={() => execCommand("justifyRight")} title="Align Right">➡</button>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("insertUnorderedList")} title="Bullet List">• List</button>
                        <button type="button" onClick={() => execCommand("insertOrderedList")} title="Numbered List">1. List</button>
                        <button type="button" onClick={() => execCommand("indent")} title="Indent">→</button>
                        <button type="button" onClick={() => execCommand("outdent")} title="Outdent">←</button>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={insertLink} title="Insert Link">🔗 Link</button>
                        <button type="button" onClick={insertImage} title="Insert Image">🖼️ Image</button>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("removeFormat")} title="Clear Formatting">✖ Clear</button>
                    </>
                )}
            </div>

            {mode === "code" ? (
                <textarea
                    value={value}
                    onChange={handleCodeChange}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="code-editor"
                    style={{ height }}
                />
            ) : (
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleContentChange}
                    onBlur={handleContentChange}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="visual-editor"
                    style={{ minHeight: height }}
                    suppressContentEditableWarning
                />
            )}

            <style jsx>{`
                .html-editor-wrapper {
                    margin: 20px 0;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    overflow: hidden;
                    background: white;
                }
                .editor-help-text {
                    background: #f0f9ff;
                    border-bottom: 1px solid #bae6fd;
                    padding: 12px 16px;
                    font-size: 13px;
                    color: #075985;
                }
                .editor-toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    padding: 10px;
                    background: #f9fafb;
                    border-bottom: 1px solid #e5e7eb;
                    align-items: center;
                }
                .editor-toolbar button {
                    padding: 6px 12px;
                    border: 1px solid #d1d5db;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                }
                .editor-toolbar button:hover {
                    background: #dc2626;
                    color: white;
                    border-color: #dc2626;
                }
                .mode-toggle {
                    font-weight: 600;
                    background: #dc2626 !important;
                    color: white !important;
                    border-color: #dc2626 !important;
                }
                .mode-toggle:hover {
                    background: #b91c1c !important;
                    border-color: #b91c1c !important;
                }
                .toolbar-select {
                    padding: 6px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 13px;
                    background: white;
                    cursor: pointer;
                }
                .toolbar-select:hover {
                    border-color: #dc2626;
                }
                .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: #d1d5db;
                    margin: 0 4px;
                }
                .color-picker {
                    width: 40px;
                    height: 32px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .visual-editor {
                    padding: 20px;
                    outline: none;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    overflow-y: auto;
                    max-height: 700px;
                }
                .visual-editor:focus {
                    background: #fafafa;
                }
                .code-editor {
                    width: 100%;
                    padding: 20px;
                    border: none;
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    resize: vertical;
                    outline: none;
                }
                .code-editor:focus {
                    background: #fafafa;
                }
            `}</style>
        </div>
    );
}
