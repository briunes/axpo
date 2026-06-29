"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { Divider, Stack, Button, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { loadSession } from "../../../lib/authSession";
import {
    getBaseValueSet,
    listBaseValueItems,
    replaceBaseValueItems,
    updateBaseValueSet,
    downloadBaseValueFile,
    type BaseValueItem,
    type BaseValueSetItem,
} from "../../../lib/internalApi";
import {
    CrudFormContainer,
    CrudPageLayout,
    FormSkeleton,
    useAlerts,
} from "../../../components/shared";
import { BaseValueItemBuilder } from "../../../components/ui/BaseValueItemBuilder";
import { BaseValueItemsViewer } from "../../../components/ui/BaseValueItemsViewer";
import { FormInput } from "../../../components/ui";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

export default function EditBaseValueSetPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [set, setSet] = useState<BaseValueSetItem | null>(null);
    const [name, setName] = useState("");
    const [sourceWorkbookRef, setSourceWorkbookRef] = useState("");
    const [sourceScope, setSourceScope] = useState("");
    const [items, setItems] = useState<BaseValueItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [formActions, setFormActions] = useState<React.ReactNode>(null);
    const breadcrumbs = useMemo(
        () => set ? [{ label: set.name, href: `/internal/base-values/${set.id}/edit` }] : null,
        [set],
    );
    useTopBarBreadcrumbs(breadcrumbs);

    useEffect(() => {
        if (!session) return;
        Promise.all([
            getBaseValueSet(session.token, id),
            listBaseValueItems(session.token, id),
        ])
            .then(([setData, fetchedItems]) => {
                setSet(setData);
                setName(setData.name);
                setSourceWorkbookRef(setData.sourceWorkbookRef ?? "");
                setSourceScope(setData.sourceScope ?? "");
                setItems(
                    fetchedItems.length > 0
                        ? fetchedItems
                        : [{ key: "", valueNumeric: undefined, unit: "" }],
                );
            })
            .catch((err) => {
                showError(err instanceof Error ? err.message : t("baseValuesModule", "notFound"));
                router.push("/internal/base-values");
            });
    }, [session, id]);

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
        if (!session || !set) return;
        if (!name.trim()) { setErrorMessage(t("baseValuesModule", "validNameRequired")); return; }
        const itemError = validateItems();
        if (itemError) { setErrorMessage(itemError); return; }

        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await updateBaseValueSet(session.token, set.id, {
                name: name.trim(),
                sourceWorkbookRef: sourceWorkbookRef.trim() || undefined,
                sourceScope: sourceScope.trim() || undefined,
            });
            await replaceBaseValueItems(
                session.token,
                set.id,
                items.map((item) => ({ ...item, key: item.key.trim() })),
            );
            showSuccess(t("baseValuesModule", "updated"));
            router.push("/internal/base-values");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("baseValuesModule", "updateFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session || !set) {
        return (
            <CrudPageLayout title={t("baseValuesModule", "editTitle")} backHref="/internal/base-values" hideHeader>
                <FormSkeleton variant="base-values" />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("baseValuesModule", "editTitle")}
            subtitle={t("baseValuesModule", "editSubtitle", {
                name: set.name,
                scope: set.scopeType === "AGENCY"
                    ? t("baseValuesModule", "scopeAgencyLabel")
                    : t("baseValuesModule", "scopeGlobalLabel"),
                version: set.version,
            })}
            backHref="/internal/base-values"
            actions={
                <>
                    {set?.sourceFileName && (
                        <Tooltip title={t("baseValuesModule", "download_tooltip")} placement="bottom">
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => downloadBaseValueFile(session!.token, id)}
                                startIcon={<DownloadIcon fontSize="small" />}
                            >
                                {t("baseValuesModule", "downloadExcel")}
                            </Button>
                        </Tooltip>
                    )}
                    {formActions}
                </>
            }
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("baseValuesModule", "saveSubmit")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/base-values")}
                isSubmitting={isSubmitting}
                onRenderActions={setFormActions}
            >
                <Stack spacing={2.5}>
                    <FormInput
                        label={t("baseValuesModule", "fieldName")}
                        type="text"
                        value={name}
                        onChange={(e) => setName((e.target as HTMLInputElement).value)}
                        required
                        autoFocus
                    />
                    <Stack direction="row" spacing={2}>
                        <FormInput
                            label={t("baseValuesModule", "fieldSourceWorkbookRef")}
                            type="text"
                            value={sourceWorkbookRef}
                            onChange={(e) =>
                                setSourceWorkbookRef((e.target as HTMLInputElement).value)
                            }
                            placeholder={t("baseValuesModule", "fieldOptionalPlaceholder")}
                            sx={{ flex: 1 }}
                        />
                        <FormInput
                            label={t("baseValuesModule", "fieldSourceScope")}
                            type="text"
                            value={sourceScope}
                            onChange={(e) =>
                                setSourceScope((e.target as HTMLInputElement).value)
                            }
                            placeholder={t("baseValuesModule", "fieldOptionalPlaceholder")}
                            sx={{ flex: 1 }}
                        />
                    </Stack>

                    <Divider />

                    {items.length > 100 ? (
                        <BaseValueItemsViewer items={items} />
                    ) : (
                        items.length > 0 && (
                            <BaseValueItemBuilder items={items} onChange={setItems} />
                        )
                    )}
                </Stack>
            </CrudFormContainer>
        </CrudPageLayout>
    );
}
