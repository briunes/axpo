"use client";

import { useState } from "react";

export interface DraggableVariablesProps {
    variables: Array<{
        name: string;
        label: string;
        description?: string;
        /** If provided, this exact string is dropped instead of {{name}} */
        dragContent?: string;
        /** Renders the item with a button-like style */
        isButton?: boolean;
    }>;
}

// ─── Group derivation ────────────────────────────────────────────────────────

const GROUP_ORDER = [
    "Buttons",
    "Charts",
    "Client",
    "User / Auth",
    "Simulation",
    "Owner / Commercial",
    "Supply Point",
    "Summary",
    "Current Plan — Periods",
    "Current Plan — Costs",
    "Current Gas Plan",
    "AXPO Plan — Periods",
    "AXPO Plan — Costs",
    "AXPO Gas Plan",
    "Price History",
    "Editable Sections",
    "Other",
];

const GROUP_ICONS: Record<string, string> = {
    "Buttons": "🔲",
    "Charts": "📊",
    "Client": "🏢",
    "User / Auth": "🔒",
    "Simulation": "📊",
    "Owner / Commercial": "👤",
    "Supply Point": "🔌",
    "Summary": "📋",
    "Current Plan — Periods": "📅",
    "Current Plan — Costs": "💶",
    "Current Gas Plan": "🔥",
    "AXPO Plan — Periods": "📅",
    "AXPO Plan — Costs": "💶",
    "AXPO Gas Plan": "🔥",
    "Price History": "📈",
    "Editable Sections": "✏️",
    "Other": "🔹",
};

function deriveGroup(name: string): string {
    if (name.startsWith("📝")) return "Editable Sections";
    if (name.startsWith("BTN_")) return "Buttons";
    if (name.startsWith("CHART_")) return "Charts";
    if (name.startsWith("CLIENT_")) return "Client";
    if (name.startsWith("CONTACT_")) return "Client";
    if (
        name.startsWith("USER_") ||
        name === "SETUP_PASSWORD_URL" ||
        name === "RESET_PASSWORD_URL" ||
        name === "MAGIC_LINK"
    ) return "User / Auth";
    if (name.startsWith("OWNER_")) return "Owner / Commercial";
    if (name.startsWith("CUPS_")) return "Supply Point";
    if (
        name.startsWith("SIMULATION_") ||
        name === "CREATED_AT" ||
        name === "EXPIRES_AT" ||
        name === "STATUS" ||
        name === "SIMULATION_LINK" ||
        name === "PIN" ||
        name === "EXPIRES_IN_DAYS"
    ) return "Simulation";
    if (
        name === "PRODUCT_NAME" ||
        name === "ANNUAL_CONSUMPTION" ||
        name === "SAVINGS_AMOUNT" ||
        name.startsWith("GAS_ANNUAL_") ||
        name.startsWith("SAVINGS_")
    ) return "Summary";
    if (name.startsWith("CURRENT_POWER_P") || name.startsWith("CURRENT_ENERGY_P")) return "Current Plan — Periods";
    if (name.startsWith("CURRENT_GAS_")) return "Current Gas Plan";
    if (name.startsWith("CURRENT_")) return "Current Plan — Costs";
    if (name.startsWith("AXPO_POWER_P") || name.startsWith("AXPO_ENERGY_P")) return "AXPO Plan — Periods";
    if (name.startsWith("AXPO_GAS_")) return "AXPO Gas Plan";
    if (name.startsWith("AXPO_")) return "AXPO Plan — Costs";
    if (
        name.startsWith("HISTORY_") ||
        name === "PRODUCT_LABEL" ||
        name === "GAS_PRODUCT_LABEL" ||
        name === "PERFIL" ||
        name === "TARIFA" ||
        name === "GAS_TARIFA"
    ) return "Price History";
    return "Other";
}

function groupVariables(
    variables: DraggableVariablesProps["variables"],
): Array<{ group: string; icon: string; items: DraggableVariablesProps["variables"] }> {
    const map = new Map<string, DraggableVariablesProps["variables"]>();
    for (const v of variables) {
        const g = deriveGroup(v.name);
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(v);
    }
    return GROUP_ORDER
        .filter((g) => map.has(g))
        .map((g) => ({ group: g, icon: GROUP_ICONS[g] ?? "🔹", items: map.get(g)! }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DraggableVariables({ variables }: DraggableVariablesProps) {
    const [isDragging, setIsDragging] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const isSearching = search.trim().length > 0;

    const filteredVariables = isSearching
        ? variables.filter(
            (v) =>
                v.name.toLowerCase().includes(search.toLowerCase()) ||
                v.label.toLowerCase().includes(search.toLowerCase()) ||
                (v.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
        )
        : variables;

    const groups = isSearching
        ? groupVariables(filteredVariables)
        : groupVariables(variables);

    const toggleGroup = (group: string) =>
        setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));

    const handleDragStart = (e: React.DragEvent, variable: DraggableVariablesProps["variables"][number]) => {
        const content = variable.dragContent ?? `{{${variable.name}}}`;
        e.dataTransfer.setData("text/plain", content);
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(variable.name);
    };

    const handleDragEnd = () => {
        setIsDragging(null);
    };

    return (
        <div className="draggable-variables-panel">
            <div className="variables-header">
                <h3>Available Variables</h3>
                <p>Drag variables into the editor</p>
                <input
                    type="search"
                    className="variables-search"
                    placeholder="Search variables…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="variables-tree">
                {groups.length === 0 && (
                    <p style={{ fontSize: "12px", color: "var(--scheme-neutral-600)", textAlign: "center", margin: "8px 0" }}>
                        No variables match "{search}"
                    </p>
                )}
                {groups.map(({ group, icon, items }) => {
                    const isOpen = !collapsed[group];
                    return (
                        <div key={group} className="variable-group">
                            <button
                                className="variable-group-header"
                                onClick={() => toggleGroup(group)}
                                title={isOpen ? "Collapse" : "Expand"}
                            >
                                <span className="group-chevron">{isOpen ? "▾" : "▸"}</span>
                                <span className="group-icon">{icon}</span>
                                <span className="group-label">{group}</span>
                                <span className="group-count">{items.length}</span>
                            </button>

                            {isOpen && (
                                <div className="variable-group-items">
                                    {items.map((variable) => (
                                        <div
                                            key={variable.name}
                                            className={`variable-item ${isDragging === variable.name ? "dragging" : ""} ${variable.isButton ? "variable-item-button" : ""}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, variable)}
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
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .draggable-variables-panel {
                    background: var(--scheme-neutral-1100);
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 8px;
                    padding: 16px;
                    max-height: 600px;
                    overflow-y: auto;
                }

                .variables-header h3 {
                    margin: 0 0 4px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--scheme-neutral-100);
                }

                .variables-header p {
                    margin: 0 0 8px 0;
                    font-size: 12px;
                    color: var(--scheme-neutral-500);
                }

                .variables-search {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 6px 10px;
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 6px;
                    font-size: 12px;
                    color: var(--scheme-neutral-100);
                    background: var(--scheme-surface-content);
                    outline: none;
                    margin-bottom: 12px;
                }

                .variables-search::placeholder {
                    color: var(--scheme-neutral-600);
                }

                .variables-search:focus {
                    border-color: var(--scheme-brand-600);
                    box-shadow: 0 0 0 2px var(--scheme-brand-600-15);
                }

                /* ── Tree ── */
                .variables-tree {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .variable-group {
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 6px;
                    overflow: hidden;
                }

                .variable-group-header {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 10px;
                    background: var(--scheme-neutral-1000);
                    border: none;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.15s;
                }

                .variable-group-header:hover {
                    background: var(--scheme-neutral-900);
                }

                .group-chevron {
                    font-size: 11px;
                    color: var(--scheme-neutral-500);
                    width: 10px;
                    flex-shrink: 0;
                }

                .group-icon {
                    font-size: 13px;
                    flex-shrink: 0;
                }

                .group-label {
                    flex: 1;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--scheme-neutral-300);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .group-count {
                    font-size: 11px;
                    color: var(--scheme-neutral-600);
                    background: var(--scheme-neutral-900);
                    border-radius: 10px;
                    padding: 1px 6px;
                    min-width: 18px;
                    text-align: center;
                }

                .variable-group-items {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    padding: 4px;
                    background: var(--scheme-neutral-1100);
                }

                .variable-item {
                    background: var(--scheme-surface-content);
                    border: 1px solid var(--scheme-neutral-900);
                    border-radius: 5px;
                    padding: 8px 10px;
                    cursor: grab;
                    transition: all 0.15s;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .variable-item:hover {
                    border-color: var(--scheme-brand-600);
                    box-shadow: 0 1px 4px var(--scheme-brand-600-15);
                    transform: translateX(2px);
                }

                .variable-item.dragging {
                    opacity: 0.5;
                    cursor: grabbing;
                }

                .variable-item-button {
                    border-color: var(--scheme-brand-600) !important;
                    background: var(--scheme-brand-600-15) !important;
                }

                .variable-item-button .variable-badge code {
                    background: var(--scheme-brand-600);
                    color: #fff;
                }

                .variable-badge {
                    display: inline-block;
                }

                .variable-badge code {
                    background: var(--scheme-brand-600-15);
                    color: var(--scheme-brand-600);
                    padding: 3px 7px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-weight: 600;
                }

                .variable-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .variable-label {
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--scheme-neutral-300);
                }

                .variable-description {
                    font-size: 11px;
                    color: var(--scheme-neutral-600);
                    line-height: 1.4;
                }

                /* Scrollbar styling */
                .draggable-variables-panel::-webkit-scrollbar {
                    width: 6px;
                }

                .draggable-variables-panel::-webkit-scrollbar-track {
                    background: var(--scheme-neutral-1000);
                    border-radius: 3px;
                }

                .draggable-variables-panel::-webkit-scrollbar-thumb {
                    background: var(--scheme-neutral-800);
                    border-radius: 3px;
                }

                .draggable-variables-panel::-webkit-scrollbar-thumb:hover {
                    background: var(--scheme-neutral-700);
                }
            `}</style>
        </div>
    );
}
