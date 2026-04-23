"use client";

import { useMemo } from "react";
import { Stack, Autocomplete, TextField, InputAdornment } from "@mui/material";
import { Country, State } from "country-state-city";
import { useI18n } from "../../../../src/lib/i18n-context";
import { FormInput } from "../ui";
import { FormSelect } from "../ui";

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
}

const inputLabelStyle = {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
} as const;

/**
 * Reusable address form section with ISO 3166-1 country selector and
 * province/state selector (or free-text input when no subdivisions exist).
 */
export function AddressForm({ value, onChange, disabled }: AddressFormProps) {
    const { t } = useI18n();

    const allCountries = useMemo(() => Country.getAllCountries(), []);

    const selectedCountry = useMemo(
        () => (value.country ? allCountries.find((c) => c.isoCode === value.country) ?? null : null),
        [value.country, allCountries]
    );

    const provinces = useMemo(
        () => (value.country ? State.getStatesOfCountry(value.country) : []),
        [value.country]
    );

    const hasProvinces = provinces.length > 0;

    return (
        <Stack spacing={2}>
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

            {/* Province + Country */}
            <Stack direction="row" spacing={2}>
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

                {/* Country — searchable autocomplete */}
                <div style={{ flex: 1 }}>
                    <label style={inputLabelStyle}>{t("addressForm", "countryLabel")}</label>
                    <Autocomplete
                        options={allCountries}
                        getOptionLabel={(opt) => opt.name}
                        value={selectedCountry}
                        disabled={disabled}
                        onChange={(_e, newValue) => {
                            onChange({
                                ...value,
                                country: newValue?.isoCode ?? "",
                                // Reset province when country changes
                                province: "",
                            });
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                size="small"
                                placeholder={selectedCountry ? undefined : t("addressForm", "countryPlaceholder")}
                                slotProps={{
                                    input: {
                                        ...params.InputProps,
                                        startAdornment: selectedCountry?.flag ? (
                                            <>
                                                <InputAdornment position="start" sx={{ ml: 0.5, mr: -0.5 }}>
                                                    <span style={{ fontSize: "18px", lineHeight: 1 }}>{selectedCountry.flag}</span>
                                                </InputAdornment>
                                                {params.InputProps.startAdornment}
                                            </>
                                        ) : params.InputProps.startAdornment,
                                    },
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "6px",
                                        "& fieldset": {
                                            borderWidth: "1px",
                                            borderColor: "rgba(0, 0, 0, 0.23)",
                                        },
                                        "&:hover fieldset": { borderColor: "rgba(0, 0, 0, 0.4)" },
                                        "&.Mui-focused fieldset": {
                                            borderWidth: "1px",
                                            borderColor: "primary.main",
                                        },
                                    },
                                }}
                            />
                        )}
                        renderOption={(props, option) => (
                            <li {...props} key={option.isoCode}>
                                {option.flag ? `${option.flag} ` : ""}
                                {option.name}
                            </li>
                        )}
                        isOptionEqualToValue={(opt, val) => opt.isoCode === val.isoCode}
                    />
                </div>
            </Stack>
        </Stack>
    );
}
