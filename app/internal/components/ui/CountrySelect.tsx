"use client";

import { useMemo } from "react";
import { Country } from "country-state-city";
import { FormSelect } from "./FormSelect";
import type { FormSelectProps } from "./FormSelect";

export interface CountrySelectProps
    extends Omit<FormSelectProps, "options" | "onChange"> {
    /** ISO 3166-1 alpha-2 country code, e.g. "ES" */
    value?: string;
    onChange?: (isoCode: string | null) => void;
}

/**
 * Country autocomplete/select with emoji flags and country names.
 * Uses FormSelect as base; value and onChange work with ISO 3166-1 alpha-2 codes.
 */
export function CountrySelect({ value, onChange, ...props }: CountrySelectProps) {
    const options = useMemo(
        () =>
            Country.getAllCountries().map((country) => ({
                value: country.isoCode,
                label: country.name,
                icon: country.flag ? (
                    <span
                        style={{ fontSize: "1.25em", lineHeight: 1, userSelect: "none" }}
                        aria-label={country.name}
                        role="img"
                    >
                        {country.flag}
                    </span>
                ) : undefined,
            })),
        []
    );

    return (
        <FormSelect
            {...props}
            options={options}
            value={value}
            onChange={(val) => onChange?.(val as string | null)}
        />
    );
}
