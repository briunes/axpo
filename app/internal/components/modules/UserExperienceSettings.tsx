"use client";

import { useState } from "react";
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

    return (
        <div className="system-settings-container">
            <div className="system-settings-tabs">
                {(Object.keys(UX_TABS) as UxTab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`settings-subtab${activeTab === tab ? " active" : ""}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {UX_TABS[tab]}
                    </button>
                ))}
            </div>

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
