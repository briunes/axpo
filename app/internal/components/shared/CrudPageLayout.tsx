"use client";

import { Stack, Divider } from "@mui/material";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "../ui/icons";

export interface CrudPageLayoutProps {
    title: string;
    subtitle?: string;
    backLabel?: string;
    backHref?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    maxWidth?: number;
}

/**
 * Content-only layout for CRUD create/edit pages
 * Designed to render within InternalWorkspace (keeps sidebar/navbar)
 * Provides consistent header, back navigation, and form area
 */
export function CrudPageLayout({
    title,
    subtitle,
    backLabel = "Back",
    backHref,
    children,
    actions,
    maxWidth,
}: CrudPageLayoutProps) {
    const router = useRouter();

    const handleBack = () => {
        if (backHref) {
            router.push(backHref);
        } else {
            router.back();
        }
    };

    return (
        <Stack spacing={0} sx={{ maxWidth: maxWidth ?? '100%', width: '100%' }}>
            {/* Header with back navigation */}
            <div className="crud-page-header">
                <div className="crud-page-title-section">
                    <div>
                        <h2 className="section-title">{title}</h2>
                        {subtitle && <p className="section-subtitle">{subtitle}</p>}
                    </div>
                    {actions && <div className="crud-page-actions">{actions}</div>}
                </div>
            </div>

            <Divider sx={{ my: 3 }} />

            {/* Content area */}
            {children}
        </Stack>
    );
}
