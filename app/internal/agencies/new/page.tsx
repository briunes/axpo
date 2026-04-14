"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stack } from "@mui/material";
import { loadSession } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { createAgency } from "../../lib/internalApi";
import { CrudFormContainer, CrudPageLayout, useAlerts } from "../../components/shared";
import { FormInput } from "../../components/ui";

export default function NewAgencyPage() {
    const router = useRouter();
    const [session] = useState(loadSession());
    const { showSuccess, showError } = useAlerts();
    const { t } = useI18n();

    const [name, setName] = useState("");
    const [street, setStreet] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [province, setProvince] = useState("");
    const [country, setCountry] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!session) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage(t("agencyFormPage", "nameRequired"));
            return;
        }
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await createAgency(session.token, {
                name: name.trim(),
                street: street.trim() || undefined,
                city: city.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                province: province.trim() || undefined,
                country: country.trim() || undefined,
            });
            showSuccess(t("agencyFormPage", "created"));
            router.push("/internal/agencies");
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("agencyFormPage", "createFailed");
            setErrorMessage(msg);
            showError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <CrudPageLayout
            title={t("agencyFormPage", "newTitle")}
            subtitle={t("agencyFormPage", "newSubtitle")}
            backHref="/internal/agencies"
        >
            <CrudFormContainer
                onSubmit={handleSubmit}
                errorMessage={errorMessage}
                submitLabel={t("agencyFormPage", "createSubmit")}
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
                        placeholder="e.g. Energía Sur S.L."
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
