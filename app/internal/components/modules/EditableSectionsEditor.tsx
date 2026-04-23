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
        Each section will appear in the draggable variables list and can be used like <code>{'{{SECTION_KEY}}'}</code>
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
          padding: 1.25rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .sections-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .sections-header h4 {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #111827;
        }

        .btn-add-section {
          padding: 0.4rem 0.875rem;
          font-size: 0.8125rem;
          font-weight: 500;
          border: 1px solid #dc2626;
          background: #ffffff;
          color: #dc2626;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-add-section:hover {
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);
        }

        .sections-description {
          margin: 0.5rem 0 1rem;
          font-size: 0.8125rem;
          color: #6b7280;
          line-height: 1.5;
        }

        .sections-description code {
          background: #fef2f2;
          color: #dc2626;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        }

        .add-section-form {
          display: flex;
          gap: 0.625rem;
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .add-section-form input {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
          font-size: 0.8125rem;
          background: #ffffff;
          transition: border-color 0.15s ease;
        }

        .add-section-form input:focus {
          outline: none;
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .add-section-form button {
          padding: 0.5rem 1.125rem;
          background: #dc2626;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-section-form button:hover {
          background: #b91c1c;
          box-shadow: 0 1px 3px rgba(220, 38, 38, 0.3);
        }

        .sections-list {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .no-sections {
          padding: 2rem;
          text-align: center;
          color: #9ca3af;
          font-size: 0.8125rem;
          background: #f9fafb;
          border: 1px dashed #d1d5db;
          border-radius: 6px;
        }

        .section-item {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 1rem;
          transition: border-color 0.15s ease;
        }

        .section-item:hover {
          border-color: #d1d5db;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.875rem;
          padding-bottom: 0.625rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .section-key {
          font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
          font-size: 0.8125rem;
          font-weight: 600;
          background: #fef2f2;
          color: #dc2626;
          padding: 0.375rem 0.625rem;
          border-radius: 4px;
          border: 1px solid #fecaca;
        }

        .btn-remove {
          background: none;
          border: none;
          font-size: 1.25rem;
          color: #ef4444;
          cursor: pointer;
          padding: 0.125rem;
          width: 28px;
          height: 28px;
          line-height: 1;
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .btn-remove:hover {
          background: #fee2e2;
          color: #dc2626;
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
          margin-bottom: 0.375rem;
          color: #374151;
        }

        .field input,
        .field textarea {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.8125rem;
          background: #ffffff;
          transition: border-color 0.15s ease;
        }

        .field input:focus,
        .field textarea:focus {
          outline: none;
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .field textarea {
          resize: vertical;
          font-family: inherit;
          line-height: 1.5;
        }

        .field-row {
          grid-column: 1 / -1;
          display: flex;
          gap: 1.5rem;
          align-items: center;
          padding-top: 0.5rem;
          border-top: 1px solid #e5e7eb;
          margin-top: 0.25rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          font-weight: 500;
        }

        .checkbox-label input[type="checkbox"] {
          cursor: pointer;
          width: 16px;
          height: 16px;
          accent-color: #dc2626;
        }

        .field.max-length {
          flex-direction: row;
          align-items: center;
          gap: 0.625rem;
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
