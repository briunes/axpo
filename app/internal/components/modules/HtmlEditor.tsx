"use client";

import { useEffect, useState, useRef } from "react";
import { useI18n } from "../../../../src/lib/i18n-context";

export interface HtmlEditorProps {
    initialHtml: string;
    onChange: (html: string) => void;
    height?: string;
}

export function HtmlEditor({ initialHtml, onChange, height = "600px" }: HtmlEditorProps) {
    const { t } = useI18n();
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
            // If the dropped content is an HTML snippet, insert as HTML; otherwise as plain text
            if (variable.trimStart().startsWith("<")) {
                document.execCommand("insertHTML", false, variable);
            } else {
                document.execCommand("insertText", false, variable);
            }
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
        const url = prompt(t("htmlEditor", "promptUrl"));
        if (url) execCommand("createLink", url);
    };

    const insertImage = () => {
        const url = prompt(t("htmlEditor", "promptImageUrl"));
        if (url) execCommand("insertImage", url);
    };

    return (
        <div className="html-editor-wrapper">

            <div className="editor-toolbar">
                <button type="button" onClick={() => setMode(mode === "visual" ? "code" : "visual")} className="mode-toggle">
                    {mode === "visual" ? t("htmlEditor", "codeMode") : t("htmlEditor", "visualMode")}
                </button>

                {mode === "visual" && (
                    <>
                        <div className="toolbar-divider"></div>
                        <select onChange={(e) => execCommand("formatBlock", e.target.value)} className="toolbar-select">
                            <option value="">{t("htmlEditor", "format")}</option>
                            <option value="p">{t("htmlEditor", "paragraph")}</option>
                            <option value="h1">{t("htmlEditor", "heading1")}</option>
                            <option value="h2">{t("htmlEditor", "heading2")}</option>
                            <option value="h3">{t("htmlEditor", "heading3")}</option>
                            <option value="h4">{t("htmlEditor", "heading4")}</option>
                            <option value="h5">{t("htmlEditor", "heading5")}</option>
                            <option value="h6">{t("htmlEditor", "heading6")}</option>
                        </select>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("bold")} title={t("htmlEditor", "bold")}><strong>B</strong></button>
                        <button type="button" onClick={() => execCommand("italic")} title={t("htmlEditor", "italic")}><em>I</em></button>
                        <button type="button" onClick={() => execCommand("underline")} title={t("htmlEditor", "underline")}><u>U</u></button>
                        <button type="button" onClick={() => execCommand("strikeThrough")} title={t("htmlEditor", "strikethrough")}><s>S</s></button>

                        <div className="toolbar-divider"></div>
                        <input
                            type="color"
                            onChange={(e) => execCommand("foreColor", e.target.value)}
                            title={t("htmlEditor", "textColor")}
                            className="color-picker"
                        />
                        <input
                            type="color"
                            onChange={(e) => execCommand("backColor", e.target.value)}
                            title={t("htmlEditor", "backgroundColor")}
                            className="color-picker"
                        />

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("justifyLeft")} title={t("htmlEditor", "alignLeft")}>⬅</button>
                        <button type="button" onClick={() => execCommand("justifyCenter")} title={t("htmlEditor", "center")}>↔</button>
                        <button type="button" onClick={() => execCommand("justifyRight")} title={t("htmlEditor", "alignRight")}>➡</button>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("insertUnorderedList")} title={t("htmlEditor", "bulletList")}>{t("htmlEditor", "bulletListLabel")}</button>
                        <button type="button" onClick={() => execCommand("insertOrderedList")} title={t("htmlEditor", "numberedList")}>{t("htmlEditor", "numberedListLabel")}</button>
                        <button type="button" onClick={() => execCommand("indent")} title={t("htmlEditor", "indent")}>→</button>
                        <button type="button" onClick={() => execCommand("outdent")} title={t("htmlEditor", "outdent")}>←</button>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={insertLink} title={t("htmlEditor", "insertLink")}>{t("htmlEditor", "insertLinkLabel")}</button>
                        <button type="button" onClick={insertImage} title={t("htmlEditor", "insertImage")}>{t("htmlEditor", "insertImageLabel")}</button>

                        <div className="toolbar-divider"></div>
                        <button type="button" onClick={() => execCommand("removeFormat")} title={t("htmlEditor", "clearFormatting")}>{t("htmlEditor", "clearFormattingLabel")}</button>
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
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 8px;
                    overflow: hidden;
                    background: var(--scheme-neutral-1200);
                }
                .editor-help-text {
                    background: rgba(56, 189, 248, 0.12);
                    border-bottom: 1px solid rgba(56, 189, 248, 0.22);
                    padding: 12px 16px;
                    color: #7dd3fc;
                }
                .editor-toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    padding: 10px;
                    background: var(--scheme-neutral-1100);
                    border-bottom: 1px solid var(--scheme-neutral-900);
                    align-items: center;
                }
                .editor-toolbar button {
                    padding: 6px 12px;
                    border: 1px solid var(--scheme-neutral-900);
                    background: var(--scheme-neutral-1200);
                    color: var(--scheme-neutral-300);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .editor-toolbar button:hover {
                    background: var(--scheme-brand-600);
                    color: white;
                    border-color: var(--scheme-brand-600);
                }
                .mode-toggle {
                    font-weight: 600;
                    background: var(--scheme-brand-600) !important;
                    color: white !important;
                    border-color: var(--scheme-brand-600) !important;
                }
                .mode-toggle:hover {
                    background: var(--scheme-brand-700) !important;
                    border-color: var(--scheme-brand-700) !important;
                }
                .toolbar-select {
                    padding: 6px 8px;
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 4px;
                    background: var(--scheme-neutral-1200);
                    color: var(--scheme-neutral-300);
                    cursor: pointer;
                }
                .toolbar-select:hover {
                    border-color: var(--scheme-brand-600);
                }
                .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: var(--scheme-neutral-900);
                    margin: 0 4px;
                }
                .color-picker {
                    width: 40px;
                    height: 32px;
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 4px;
                    cursor: pointer;
                    background: var(--scheme-neutral-1200);
                }
                .visual-editor {
                    padding: 20px;
                    outline: none;
                    color: var(--scheme-neutral-100);
                    background: var(--scheme-neutral-1200);
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    overflow-y: auto;
                    max-height: 700px;
                }
                .visual-editor:focus {
                    background: var(--scheme-neutral-1100);
                }
                .code-editor {
                    width: 100%;
                    padding: 20px;
                    border: none;
                    color: var(--scheme-neutral-100);
                    background: var(--scheme-neutral-1200);
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    line-height: 1.6;
                    resize: vertical;
                    outline: none;
                }
                .code-editor:focus {
                    background: var(--scheme-neutral-1100);
                }
            `}</style>
        </div>
    );
}
