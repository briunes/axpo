"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "../../lib/authSession";
import { usePermissions } from "../../lib/permissionsContext";
import { useI18n } from "../../../../src/lib/i18n-context";
import { CrudPageLayout, useAlerts } from "../../components/shared";
import { UserSessionsPanel } from "../../components/modules/UserSessionsPanel";
import { useUserPreferences } from "../../components/providers/UserPreferencesProvider";

export default function UserSessionsPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { canDo } = usePermissions();
    const { t } = useI18n();
    const { preferences } = useUserPreferences();

    const canManageUserSessions = session ? canDo(session.user.role, "users.sessions.manage") : false;

    useEffect(() => {
        if (session && !canManageUserSessions) {
            router.replace("/internal/users");
        }
    }, [canManageUserSessions, router, session]);

    if (!session || !canManageUserSessions) {
        return null;
    }

    return (
        <CrudPageLayout
            title={t("userSessions", "title")}
            subtitle={t("userSessions", "subtitle")}
            backHref="/internal/users"
            maxWidth={undefined}
        >
            <UserSessionsPanel
                session={session}
                initialPageSize={preferences.itemsPerPage}
                showUserColumn
                allowGlobalLogoutAll
                onNotify={(message, tone) =>
                    tone === "success" ? showSuccess(message) : showError(message)
                }
            />
        </CrudPageLayout>
    );
}
