"use client";

import { useState } from "react";

export interface DraggableVariablesProps {
    variables: Array<{
        name: string;
        label: string;
        description?: string;
    }>;
}

export function DraggableVariables({ variables }: DraggableVariablesProps) {
    const [isDragging, setIsDragging] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, variableName: string) => {
        e.dataTransfer.setData("text/plain", `{{${variableName}}}`);
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(variableName);
    };

    const handleDragEnd = () => {
        setIsDragging(null);
    };

    return (
        <div className="draggable-variables-panel">
            <div className="variables-header">
                <h3>Available Variables</h3>
                <p>Drag variables into the editor</p>
            </div>

            <div className="variables-list">
                {variables.map((variable) => (
                    <div
                        key={variable.name}
                        className={`variable-item ${isDragging === variable.name ? "dragging" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, variable.name)}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="variable-badge">
                            <code>{`{{${variable.name}}}`}</code>
                        </div>
                        <div className="variable-info">
                            <span className="variable-label">{variable.label}</span>
                            {variable.description && (
                                <span className="variable-description">{variable.description}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .draggable-variables-panel {
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px;
                    max-height: 600px;
                    overflow-y: auto;
                }

                .variables-header h3 {
                    margin: 0 0 4px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #111827;
                }

                .variables-header p {
                    margin: 0 0 16px 0;
                    font-size: 12px;
                    color: #6b7280;
                }

                .variables-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .variable-item {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    padding: 10px 12px;
                    cursor: grab;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .variable-item:hover {
                    border-color: #dc2626;
                    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.1);
                    transform: translateY(-1px);
                }

                .variable-item.dragging {
                    opacity: 0.5;
                    cursor: grabbing;
                }

                .variable-badge {
                    display: inline-block;
                }

                .variable-badge code {
                    background: #fef2f2;
                    color: #dc2626;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-weight: 600;
                }

                .variable-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .variable-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: #374151;
                }

                .variable-description {
                    font-size: 11px;
                    color: #9ca3af;
                }

                /* Scrollbar styling */
                .draggable-variables-panel::-webkit-scrollbar {
                    width: 6px;
                }

                .draggable-variables-panel::-webkit-scrollbar-track {
                    background: #f3f4f6;
                    border-radius: 3px;
                }

                .draggable-variables-panel::-webkit-scrollbar-thumb {
                    background: #d1d5db;
                    border-radius: 3px;
                }

                .draggable-variables-panel::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                }
            `}</style>
        </div>
    );
}
