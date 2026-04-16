/**
 * Editable Sections Editor
 * 
 * Component for configuring which sections of a template are editable
 * and setting their default values.
 */

"use client";

import { useState } from "react";
import type { EditableSectionsConfig, EditableSectionDefinition } from "../../../../src/infrastructure/templates/editableSections";

interface EditableSectionsEditorProps {
    value: EditableSectionsConfig | null;
    onChange: (sections: EditableSectionsConfig) => void;
}

export function EditableSectionsEditor({ value, onChange }: EditableSectionsEditorProps) {
    const [sections, setSections] = useState<EditableSectionsConfig>(value || {});
    const [newSectionKey, setNewSectionKey] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);

    const handleAddSection = () => {
        if (!newSectionKey || sections[newSectionKey]) return;

        const newSection: EditableSectionDefinition = {
            label: newSectionKey.replace(/_/g, " "),
            default: "",
            multiline: true,
        };

        const updated = { ...sections, [newSectionKey]: newSection };
        setSections(updated);
        onChange(updated);
        setNewSectionKey("");
        setShowAddForm(false);
    };

    const handleUpdateSection = (key: string, updates: Partial<EditableSectionDefinition>) => {
        const updated = {
            ...sections,
            [key]: { ...sections[key], ...updates },
        };
        setSections(updated);
        onChange(updated);
    };

    const handleRemoveSection = (key: string) => {
        const updated = { ...sections };
        delete updated[key];
        setSections(updated);
        onChange(updated);
    };

    return (
        <div className="editable-sections-editor">
            <div className="sections-header">
                <h4>Editable Sections</h4>
                <button
                    type="button"
                    className="btn-add-section"
                    onClick={() => setShowAddForm(!showAddForm)}
                >
                    {showAddForm ? "Cancel" : "+ Add Section"}
                </button>
            </div>

            <p className="sections-description">
                Define which parts of this template users can edit when using it.
                Each section will be available as a variable like <code>{'{{SECTION_KEY}}'}</code>
            </p>

            {showAddForm && (
                <div className="add-section-form">
                    <input
                        type="text"
                        placeholder="SECTION_KEY (e.g., INTRO_TEXT)"
                        value={newSectionKey}
                        onChange={(e) => setNewSectionKey(e.target.value.toUpperCase().replace(/[^A-Z_]/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                    />
                    <button type="button" onClick={handleAddSection}>
                        Add
                    </button>
                </div>
            )}

            <div className="sections-list">
                {Object.keys(sections).length === 0 ? (
                    <p className="no-sections">
                        No editable sections defined. Add sections to allow users to customize specific parts of this template.
                    </p>
                ) : (
                    Object.entries(sections).map(([key, section]) => (
                        <div key={key} className="section-item">
                            <div className="section-header">
                                <code className="section-key">{'{{' + key + '}}'}</code>
                                <button
                                    type="button"
                                    className="btn-remove"
                                    onClick={() => handleRemoveSection(key)}
                                    title="Remove section"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="section-fields">
                                <div className="field">
                                    <label>Label:</label>
                                    <input
                                        type="text"
                                        value={section.label}
                                        onChange={(e) => handleUpdateSection(key, { label: e.target.value })}
                                        placeholder="Display name"
                                    />
                                </div>

                                <div className="field">
                                    <label>Description:</label>
                                    <input
                                        type="text"
                                        value={section.description || ""}
                                        onChange={(e) => handleUpdateSection(key, { description: e.target.value })}
                                        placeholder="Help text (optional)"
                                    />
                                </div>

                                <div className="field full-width">
                                    <label>Default Text:</label>
                                    {section.multiline ? (
                                        <textarea
                                            value={section.default}
                                            onChange={(e) => handleUpdateSection(key, { default: e.target.value })}
                                            placeholder="Default text content..."
                                            rows={3}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={section.default}
                                            onChange={(e) => handleUpdateSection(key, { default: e.target.value })}
                                            placeholder="Default text content..."
                                        />
                                    )}
                                </div>

                                <div className="field-row">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={section.multiline || false}
                                            onChange={(e) => handleUpdateSection(key, { multiline: e.target.checked })}
                                        />
                                        Multiline
                                    </label>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={section.required || false}
                                            onChange={(e) => handleUpdateSection(key, { required: e.target.checked })}
                                        />
                                        Required
                                    </label>

                                    <div className="field max-length">
                                        <label>Max Length:</label>
                                        <input
                                            type="number"
                                            value={section.maxLength || ""}
                                            onChange={(e) =>
                                                handleUpdateSection(key, {
                                                    maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                                                })
                                            }
                                            placeholder="No limit"
                                            min="1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style jsx>{`
        .editable-sections-editor {
          margin-top: 1.5rem;
          padding: 1rem;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background: #f9f9f9;
        }

        .sections-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .sections-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .btn-add-section {
          padding: 0.4rem 0.8rem;
          font-size: 0.875rem;
          border: 1px solid #007bff;
          background: white;
          color: #007bff;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-add-section:hover {
          background: #007bff;
          color: white;
        }

        .sections-description {
          margin: 0.5rem 0 1rem;
          font-size: 0.875rem;
          color: #666;
        }

        .sections-description code {
          background: #fff;
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.85em;
        }

        .add-section-form {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .add-section-form input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: monospace;
        }

        .add-section-form button {
          padding: 0.5rem 1rem;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .add-section-form button:hover {
          background: #218838;
        }

        .sections-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .no-sections {
          padding: 2rem;
          text-align: center;
          color: #999;
          font-size: 0.875rem;
          background: white;
          border-radius: 4px;
        }

        .section-item {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 1rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #eee;
        }

        .section-key {
          font-family: monospace;
          font-size: 0.9rem;
          font-weight: 600;
          background: #f0f0f0;
          padding: 0.3rem 0.6rem;
          border-radius: 3px;
        }

        .btn-remove {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #dc3545;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          line-height: 1;
        }

        .btn-remove:hover {
          color: #c82333;
        }

        .section-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .field {
          display: flex;
          flex-direction: column;
        }

        .field.full-width {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: #555;
        }

        .field input,
        .field textarea {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .field textarea {
          resize: vertical;
          font-family: inherit;
        }

        .field-row {
          grid-column: 1 / -1;
          display: flex;
          gap: 1.5rem;
          align-items: center;
          padding-top: 0.5rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          cursor: pointer;
        }

        .field.max-length {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
        }

        .field.max-length label {
          margin-bottom: 0;
          white-space: nowrap;
        }

        .field.max-length input {
          width: 100px;
        }
      `}</style>
        </div>
    );
}
