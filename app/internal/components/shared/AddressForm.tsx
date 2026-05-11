"use client";

import { useMemo } from "react";
import { Stack } from "@mui/material";
import { State } from "country-state-city";
import { useI18n } from "../../../../src/lib/i18n-context";
import { FormInput, FormSelect, CountrySelect } from "../ui";

export interface AddressData {
    street?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    /** ISO 3166-1 alpha-2 country code, e.g. "ES", "PT", "FR" */
    country?: string;
}

interface AddressFormProps {
    value: AddressData;
    onChange: (value: AddressData) => void;
    disabled?: boolean;
    countryRequired?: boolean;
    countryError?: string;
}

/**
 * Reusable address form section with ISO 3166-1 country selector and
 * province/state selector (or free-text input when no subdivisions exist).
 */
export function AddressForm({ value = {}, onChange, disabled, countryRequired, countryError }: AddressFormProps) {
    const { t } = useI18n();

    const provinces = useMemo(
        () => (value.country ? State.getStatesOfCountry(value.country) : []),
        [value.country]
    );

    const hasProvinces = provinces.length > 0;

    return (
        <Stack spacing={2}>
            {/* Country + Province */}
            <Stack direction="row" spacing={2}>
                {/* Country — searchable autocomplete */}
                <div style={{ flex: 1 }}>
                    <CountrySelect
                        label={t("addressForm", "countryLabel")}
                        value={value.country ?? ""}
                        onChange={(isoCode) =>
                            onChange({
                                ...value,
                                country: isoCode ?? "",
                                // Reset province when country changes
                                province: "",
                            })
                        }
                        placeholder={t("addressForm", "countryPlaceholder")}
                        disabled={disabled}
                        required={countryRequired}
                        error={!!countryError}
                        helperText={countryError}
                    />
                </div>

                {/* Province — select (when country has subdivisions) or free text */}
                <div style={{ flex: 1 }}>
                    {hasProvinces ? (
                        <FormSelect
                            label={t("addressForm", "provinceLabel")}
                            value={value.province ?? ""}
                            onChange={(val) =>
                                onChange({ ...value, province: val as string })
                            }
                            options={[
                                { value: "", label: t("addressForm", "provinceSelectPlaceholder") },
                                ...provinces.map((s) => ({ value: s.name, label: s.name }))
                            ]}
                            placeholder={t("addressForm", "provinceSelectPlaceholder")}
                            disabled={disabled}
                        />
                    ) : (
                        <FormInput
                            label={t("addressForm", "provinceLabel")}
                            type="text"
                            value={value.province ?? ""}
                            onChange={(e) =>
                                onChange({ ...value, province: (e.target as HTMLInputElement).value })
                            }
                            placeholder={t("addressForm", "provincePlaceholder")}
                            disabled={disabled}
                        />
                    )}
                </div>
            </Stack>

            {/* Street */}
            <FormInput
                label={t("addressForm", "streetLabel")}
                type="text"
                value={value.street ?? ""}
                onChange={(e) =>
                    onChange({ ...value, street: (e.target as HTMLInputElement).value })
                }
                placeholder={t("addressForm", "streetPlaceholder")}
                disabled={disabled}
            />

            {/* City + Postal code */}
            <Stack direction="row" spacing={2}>
                <FormInput
                    label={t("addressForm", "cityLabel")}
                    type="text"
                    value={value.city ?? ""}
                    onChange={(e) =>
                        onChange({ ...value, city: (e.target as HTMLInputElement).value })
                    }
                    placeholder={t("addressForm", "cityPlaceholder")}
                    disabled={disabled}
                />
                <FormInput
                    label={t("addressForm", "postalCodeLabel")}
                    type="text"
                    value={value.postalCode ?? ""}
                    onChange={(e) =>
                        onChange({ ...value, postalCode: (e.target as HTMLInputElement).value })
                    }
                    placeholder={t("addressForm", "postalCodePlaceholder")}
                    disabled={disabled}
                />
            </Stack>
        </Stack>
    );
}
