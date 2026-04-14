"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Stack } from "@mui/material";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import { getAgency, updateAgency, type AgencyItem } from "../../../lib/internalApi";
import { CrudFormContainer, CrudPageLayout, LoadingState, useAlerts } from "../../../components/shared";
import { FormInput } from "../../../components/ui";

export default function EditAgencyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [agency, setAgency] = useState<AgencyItem | null>(null);
    const [name, setName] = useState("");
    const [street, setStreet] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [province, setProvince] = useState("");
    const [country, setCountry] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!session) return;
        getAgency(session.token, id)
            .then((a) => {
                setAgency(a);
                setName(a.name);
                setStreet(a.street || "");
                setCity(a.city || "");
                setPostalCode(a.postalCode || "");
                setProvince(a.province || "");
                setCountry(a.country || "");
            })
            .catch((err) => {
                showError(err instanceof Error ? err.message : t("agencyFormPage", "notFound"));
                router.push("/internal/agencies");
            });
    }, [session, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !agency) return;
        if (!name.trim()) {
            setErrorMessage(t("agencyFormPage", "nameRequired"));
            return;
        }
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await updateAgency(session.token, agency.id, {
                name: name.trim(),
                street: street.trim() || undefined,
                city: city.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                province: province.trim() || undefined,
                country: country.trim() || undefined,
            });
            showSuccess(t("agencyFormPage", "updated"));
            router.push("/internal/agencies");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("agencyFormPage", "updateFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!session || !agency) {
        return (
            <CrudPageLayout title={t("agencyFormPage", "editTitle")} backHref="/internal/agencies">
                <LoadingState message={t("agencyFormPage", "loading")} size={100} />
            </CrudPageLayout>
        );
    }

    return (
        <CrudPageLayout
            title={t("agencyFormPage", "editTitle")}
            subtitle={t("agencyFormPage", "editSubtitle", { name: agency.name })}
            backHref="/internal/agencies"
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("actions", "saveChanges")}
                cancelLabel={t("actions", "cancel")}
                onCancel={() => router.push("/internal/agencies")}
                isSubmitting={isSubmitting}
            >
                <Stack spacing={2}>
                    <FormInput
                        label={t("agencyFormPage", "nameLabel")}
                        type="text"
                        value={name}
                        onChange={(e) => setName((e.target as HTMLInputElement).value)}
                        autoFocus
                    />
                    <FormInput
                        label={t("agencyFormPage", "streetLabel")}
                        type="text"
                        value={street}
                        onChange={(e) => setStreet((e.target as HTMLInputElement).value)}
                        placeholder="e.g. Calle Mayor 123"
                    />
                    <Stack direction="row" spacing={2}>
                        <FormInput
                            label={t("agencyFormPage", "cityLabel")}
                            type="text"
                            value={city}
                            onChange={(e) => setCity((e.target as HTMLInputElement).value)}
                            placeholder="e.g. Madrid"
                        />
                        <FormInput
                            label={t("agencyFormPage", "postalCodeLabel")}
                            type="text"
                            value={postalCode}
                            onChange={(e) => setPostalCode((e.target as HTMLInputElement).value)}
                            placeholder="e.g. 28001"
                        />
                    </Stack>
                    <Stack direction="row" spacing={2}>
                        <FormInput
                            label={t("agencyFormPage", "provinceLabel")}
                            type="text"
                            value={province}
                            onChange={(e) => setProvince((e.target as HTMLInputElement).value)}
                            placeholder="e.g. Madrid"
                        />
                        <FormInput
                            label={t("agencyFormPage", "countryLabel")}
                            type="text"
                            value={country}
                            onChange={(e) => setCountry((e.target as HTMLInputElement).value)}
                            placeholder="e.g. España"
                        />
                    </Stack>
                </Stack>
            </CrudFormContainer>
        </CrudPageLayout>
    );
}
