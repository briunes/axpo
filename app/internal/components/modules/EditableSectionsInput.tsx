/**
 * Editable Sections Input
 * 
 * Component for users to customize editable sections when using a template
 * (e.g., when sharing a simulation via email/PDF)
 */

"use client";

import { useState, useEffect } from "react";
import type { EditableSectionsConfig, EditableSectionOverrides } from "../../../../src/infrastructure/templates/editableSections";

interface EditableSectionsInputProps {
    sections: EditableSectionsConfig | null;
    value: EditableSectionOverrides;
    onChange: (overrides: EditableSectionOverrides) => void;
}

export function EditableSectionsInput({ sections, value, onChange }: EditableSectionsInputProps) {
    const [overrides, setOverrides] = useState<EditableSectionOverrides>(value);

    useEffect(() => {
        setOverrides(value);
    }, [value]);

    if (!sections || Object.keys(sections).length === 0) {
        return null;
    }

    const handleChange = (key: string, newValue: string) => {
        const updated = { ...overrides, [key]: newValue };
        setOverrides(updated);
        onChange(updated);
    };

    return (
        <div className="editable-sections-input">
            <h4 className="sections-title">Editable Sections</h4>
            <p className="sections-subtitle">
                Customize the following text sections for this specific sharing:
            </p>

            <div className="sections-grid">
                {Object.entries(sections).map(([key, definition]) => {
                    const currentValue = overrides[key] ?? definition.default;

                    return (
                        <div key={key} className="section-field">
                            <label>
                                <span className="section-label">
                                    {definition.label}
                                    {definition.required && <span className="required">*</span>}
                                </span>
                                {definition.description && (
                                    <span className="section-description">{definition.description}</span>
                                )}
                            </label>

                            {definition.multiline ? (
                                <textarea
                                    value={currentValue}
                                    onChange={(e) => handleChange(key, e.target.value)}
                                    placeholder={definition.default}
                                    rows={3}
                                    maxLength={definition.maxLength}
                                    required={definition.required}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => handleChange(key, e.target.value)}
                                    placeholder={definition.default}
                                    maxLength={definition.maxLength}
                                    required={definition.required}
                                />
                            )}

                            {definition.maxLength && (
                                <span className="char-count">
                                    {currentValue.length} / {definition.maxLength}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
        .editable-sections-input {
          margin: 1.5rem 0;
          padding: 1.25rem;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
        }

        .sections-title {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: #212529;
        }

        .sections-subtitle {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #6c757d;
        }

        .sections-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .section-field {
          display: flex;
          flex-direction: column;
        }

        .section-field label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .section-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #495057;
        }

        .required {
          color: #dc3545;
          margin-left: 0.25rem;
        }

        .section-description {
          font-size: 0.75rem;
          color: #6c757d;
          font-weight: normal;
        }

        .section-field input,
        .section-field textarea {
          padding: 0.625rem;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 0.875rem;
          font-family: inherit;
          background: white;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .section-field input:focus,
        .section-field textarea:focus {
          border-color: #80bdff;
          outline: 0;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }

        .section-field textarea {
          resize: vertical;
          min-height: 80px;
        }

        .char-count {
          font-size: 0.75rem;
          color: #6c757d;
          text-align: right;
          margin-top: 0.25rem;
        }

        @media (min-width: 768px) {
          .sections-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.25rem;
          }
        }
      `}</style>
        </div>
    );
}
