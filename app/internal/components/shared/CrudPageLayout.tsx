"use client";

import { Stack, Typography } from "@mui/material";

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
                                <Typography variant="subtitle1" component="h2" className="section-title" sx={{ fontWeight: 600 }}>
                                    {title}
                                </Typography>
                                {subtitle && (
                                    <Typography variant="body2" component="p" className="section-subtitle" color="text.secondary">
                                        {subtitle}
                                    </Typography>
                                )}
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
