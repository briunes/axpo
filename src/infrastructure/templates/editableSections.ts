/**
 * Editable Sections for Templates
 *
 * This module provides utilities for managing editable text sections in PDF and Email templates.
 * Editable sections allow users to customize specific parts of templates while maintaining
 * the overall template structure.
 */

/**
 * Definition of an editable section in a template
 */
export interface EditableSectionDefinition {
  label: string; // Display name for the section
  default: string; // Default text content
  description?: string; // Help text explaining what this section is for
  multiline?: boolean; // Whether this section supports multiple lines
  maxLength?: number; // Optional maximum character length
  required?: boolean; // Whether this section must have content
}

/**
 * Collection of editable section definitions
 * Key format: SECTION_KEY (e.g., "INTRO_TEXT", "CLOSING_TEXT")
 */
export type EditableSectionsConfig = Record<string, EditableSectionDefinition>;

/**
 * Runtime overrides for editable sections
 * Key matches the section key, value is the custom text
 */
export type EditableSectionOverrides = Record<string, string>;

/**
 * Merges template editable sections with runtime overrides
 *
 * @param templateSections - The editable sections defined in the template (from DB)
 * @param overrides - Custom text provided at render time
 * @returns Record of section keys to final text values
 *
 * @example
 * const sections = {
 *   INTRO_TEXT: { label: "Intro", default: "Default intro text" },
 *   CLOSING_TEXT: { label: "Closing", default: "Default closing" }
 * };
 * const overrides = { INTRO_TEXT: "Custom intro" };
 * const merged = mergeEditableSections(sections, overrides);
 * // Result: { INTRO_TEXT: "Custom intro", CLOSING_TEXT: "Default closing" }
 */
export function mergeEditableSections(
  templateSections: EditableSectionsConfig | null | undefined,
  overrides?: EditableSectionOverrides,
): Record<string, string> {
  const result: Record<string, string> = {};

  // If no editable sections defined, return empty
  if (!templateSections) {
    return result;
  }

  // Process each defined section
  for (const [key, definition] of Object.entries(templateSections)) {
    // Use override if provided, otherwise use default
    const customText = overrides?.[key];
    const raw =
      customText !== undefined && customText !== null
        ? customText
        : definition.default;
    // Convert newlines to <br> so multi-line text renders correctly in HTML
    result[key] = raw.replace(/\n/g, "<br>");
  }

  return result;
}

/**
 * Extracts editable section keys from template content
 * Looks for {{SECTION_KEY}} patterns that might be editable sections
 *
 * @param htmlContent - The template HTML content
 * @returns Array of potential editable section keys
 */
export function extractEditableSectionKeys(htmlContent: string): string[] {
  const regex = /\{\{([A-Z_]+)\}\}/g;
  const keys = new Set<string>();
  let match;

  while ((match = regex.exec(htmlContent)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys);
}

/**
 * Validates editable section overrides against template definition
 *
 * @param templateSections - The editable sections defined in the template
 * @param overrides - Custom text provided by user
 * @returns Array of validation error messages (empty if valid)
 */
export function validateEditableSections(
  templateSections: EditableSectionsConfig | null | undefined,
  overrides: EditableSectionOverrides,
): string[] {
  const errors: string[] = [];

  if (!templateSections) {
    return errors;
  }

  for (const [key, value] of Object.entries(overrides)) {
    const definition = templateSections[key];

    if (!definition) {
      errors.push(`Unknown editable section: ${key}`);
      continue;
    }

    // Check required
    if (definition.required && (!value || value.trim() === "")) {
      errors.push(`${definition.label} is required`);
    }

    // Check max length
    if (definition.maxLength && value && value.length > definition.maxLength) {
      errors.push(
        `${definition.label} exceeds maximum length of ${definition.maxLength} characters`,
      );
    }
  }

  // Check for missing required sections
  for (const [key, definition] of Object.entries(templateSections)) {
    if (definition.required && !overrides[key]) {
      errors.push(`${definition.label} is required`);
    }
  }

  return errors;
}

/**
 * Default editable sections for simulation PDF templates
 */
export const DEFAULT_SIMULATION_PDF_SECTIONS: EditableSectionsConfig = {
  INTRO_TEXT: {
    label: "Texto de Introducción",
    default:
      "Esta es la simulación solicitada.\nPara cualquier consulta, no dude en contactarnos.",
    description: "Texto que aparece al inicio del PDF",
    multiline: true,
    maxLength: 500,
  },
  CLOSING_TEXT: {
    label: "Texto de Cierre",
    default: "Gracias por su confianza.",
    description: "Texto que aparece al final del PDF",
    multiline: false,
    maxLength: 200,
  },
};

/**
 * Default editable sections for simulation email templates
 */
export const DEFAULT_SIMULATION_EMAIL_SECTIONS: EditableSectionsConfig = {
  EMAIL_INTRO: {
    label: "Introducción del Email",
    default: "Le enviamos la simulación solicitada.",
    description: "Texto de introducción en el cuerpo del email",
    multiline: true,
    maxLength: 1000,
  },
  EMAIL_CLOSING: {
    label: "Despedida del Email",
    default: "Quedamos a su disposición para cualquier aclaración.",
    description: "Texto de despedida en el email",
    multiline: true,
    maxLength: 500,
  },
};
