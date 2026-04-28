"use client";

import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { UserPreferencesSettings } from "./UserPreferencesSettings";
import { RolePermissionsEditor } from "./RolePermissionsEditor";

export interface UserExperienceSettingsProps {
    session: SessionState;
    onNotify: (message: string, tone: "success" | "error") => void;
}

type UxTab = "preferences" | "permissions";

export function UserExperienceSettings({ session, onNotify }: UserExperienceSettingsProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<UxTab>("preferences");

    const UX_TABS: Record<UxTab, string> = {
        preferences: t("systemSettings", "tabPreferences"),
        permissions: t("configurationsModule", "tabRolePermissions"),
    };

    const tabIndex = (Object.keys(UX_TABS) as UxTab[]).indexOf(activeTab);

    return (
        <div className="system-settings-container">
            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, newValue) => {
                        const tabs = Object.keys(UX_TABS) as UxTab[];
                        setActiveTab(tabs[newValue]);
                    }}
                >
                    {(Object.keys(UX_TABS) as UxTab[]).map((tab) => (
                        <Tab key={tab} label={UX_TABS[tab]} sx={{textTransform: 'none'}}/>
                    ))}
                </Tabs>
            </Box>

            <div className="system-settings-content">
                {activeTab === "preferences" && (
                    <UserPreferencesSettings session={session} onNotify={onNotify} />
                )}
                {activeTab === "permissions" && (
                    <RolePermissionsEditor session={session} onNotify={onNotify} />
                )}
            </div>
        </div>
    );
}
