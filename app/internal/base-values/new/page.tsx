"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Divider, MenuItem, Stack } from "@mui/material";
import { loadSession } from "../../lib/authSession";
import { createBaseValueSet, isAdmin, type BaseValueItem } from "../../lib/internalApi";
import { useAgencies } from "../../components/hooks/useAgencies";
import { CrudFormContainer, CrudPageLayout, useAlerts } from "../../components/shared";
import { BaseValueItemBuilder } from "../../components/ui/BaseValueItemBuilder";
import { FormInput } from "../../components/ui";
import { useI18n } from "../../../../src/lib/i18n-context";

const defaultItem = (): BaseValueItem => ({ key: "", valueNumeric: undefined, unit: "" });

export default function NewBaseValueSetPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const agenciesActions = useAgencies(session);

    const [name, setName] = useState("");
    const [scopeType, setScopeType] = useState<"GLOBAL" | "AGENCY">("GLOBAL");
    const [agencyId, setAgencyId] = useState("");
    const [sourceWorkbookRef, setSourceWorkbookRef] = useState("");
    const [sourceScope, setSourceScope] = useState("");
    const [items, setItems] = useState<BaseValueItem[]>([defaultItem()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!session) return;
        if (!isAdmin(session.user.role)) {
            router.replace("/internal/base-values");
            return;
        }
        agenciesActions.refresh();
    }, [session]);

    if (!session) return null;

    const validateItems = (): string | null => {
        for (let i = 0; i < items.length; i++) {
            if (!items[i].key?.trim()) return t("baseValuesModule", "validRowKeyRequired", { row: i + 1 });
            if (items[i].valueNumeric === undefined && !items[i].valueText) {
                return t("baseValuesModule", "validRowValueRequired", { row: i + 1 });
            }
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setErrorMessage(t("baseValuesModule", "validNameRequired")); return; }
        if (scopeType === "AGENCY" && !agencyId) { setErrorMessage(t("baseValuesModule", "validAgencyRequired")); return; }
        const itemError = validateItems();
        if (itemError) { setErrorMessage(itemError); return; }

        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await createBaseValueSet(session.token, {
                name: name.trim(),
                scopeType,
                agencyId: scopeType === "AGENCY" ? agencyId : undefined,
                sourceWorkbookRef: sourceWorkbookRef.trim() || undefined,
                sourceScope: sourceScope.trim() || undefined,
                items: items.map((item) => ({ ...item, key: item.key.trim() })),
            });
            showSuccess(t("baseValuesModule", "created"));
            router.push("/internal/base-values");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("baseValuesModule", "createFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CrudPageLayout
            title={t("baseValuesModule", "newTitle")}
            subtitle={t("baseValuesModule", "newSubtitle")}
            backHref="/internal/base-values"
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("baseValuesModule", "createSubmit")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/base-values")}
                isSubmitting={isSubmitting}
            >
                <Stack spacing={2.5}>
                    <FormInput
                        label={t("baseValuesModule", "fieldName")}
                        type="text"
                        value={name}
                        onChange={(e) => setName((e.target as HTMLInputElement).value)}
                        placeholder={t("baseValuesModule", "fieldNamePlaceholder")}
                        required
                        autoFocus
                    />
                    <Stack direction="row" spacing={2}>
                        <FormInput
                            label={t("baseValuesModule", "fieldScope")}
                            select
                            value={scopeType}
                            onChange={(e) => {
                                setScopeType((e.target as HTMLInputElement).value as "GLOBAL" | "AGENCY");
                                setAgencyId("");
                            }}
                            sx={{ flex: 1 }}
                        >
                            <MenuItem value="GLOBAL">{t("baseValuesModule", "scopeGlobal")}</MenuItem>
                            <MenuItem value="AGENCY">{t("baseValuesModule", "scopeAgency")}</MenuItem>
                        </FormInput>
                        {scopeType === "AGENCY" && (
                            <FormInput
                                label={t("baseValuesModule", "fieldAgency")}
                                select
                                value={agencyId}
                                onChange={(e) => setAgencyId((e.target as HTMLInputElement).value)}
                                sx={{ flex: 2 }}
                                required
                            >
                                <MenuItem value="">{t("baseValuesModule", "selectAgencyPlaceholder")}</MenuItem>
                                {agenciesActions.agencies.map((a) => (
                                    <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                                ))}
                            </FormInput>
                        )}
                    </Stack>
                    <Stack direction="row" spacing={2}>
                        <FormInput
                            label={t("baseValuesModule", "fieldSourceWorkbookRef")}
                            type="text"
                            value={sourceWorkbookRef}
                            onChange={(e) => setSourceWorkbookRef((e.target as HTMLInputElement).value)}
                            placeholder={t("baseValuesModule", "fieldOptionalPlaceholder")}
                            sx={{ flex: 1 }}
                        />
                        <FormInput
                            label={t("baseValuesModule", "fieldSourceScope")}
                            type="text"
                            value={sourceScope}
                            onChange={(e) => setSourceScope((e.target as HTMLInputElement).value)}
                            placeholder={t("baseValuesModule", "fieldOptionalPlaceholder")}
                            sx={{ flex: 1 }}
                        />
                    </Stack>

                    <Divider />

                    <BaseValueItemBuilder items={items} onChange={setItems} />
                </Stack>
            </CrudFormContainer>
        </CrudPageLayout>
    );
}
