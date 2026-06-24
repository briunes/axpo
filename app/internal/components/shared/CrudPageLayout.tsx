"use client";

import { Stack } from "@mui/material";

export interface CrudPageLayoutProps {
    title: string;
    subtitle?: string;
    backLabel?: string;
    backHref?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    maxWidth?: number;
    hideHeader?: boolean;
}

/**
 * Content-only layout for CRUD create/edit pages
 * Designed to render within InternalWorkspace (keeps sidebar/navbar)
 * Provides consistent header, back navigation, and form area
 */
export function CrudPageLayout({
    title,
    subtitle,
    children,
    actions,
    maxWidth,
    hideHeader = false,
}: CrudPageLayoutProps) {
    return (
        <Stack
            spacing={0}
            className={hideHeader ? "crud-page-frame" : "crud-page-shell"}
            sx={{ maxWidth: maxWidth ?? "100%", width: "100%" }}
        >
            {!hideHeader && (
                <>
                    <div className="crud-page-header">
                        <div className="crud-page-title-section">
                            <div className="crud-page-title-copy">
                                <h2 className="section-title">{title}</h2>
                                {subtitle && <p className="section-subtitle">{subtitle}</p>}
                            </div>
                            {actions && <div className="crud-page-actions">{actions}</div>}
                        </div>
                    </div>

                    <div className="crud-page-divider" />
                </>
            )}

            {children}
        </Stack>
    );
}
