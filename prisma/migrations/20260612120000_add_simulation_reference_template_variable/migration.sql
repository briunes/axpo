INSERT INTO "template_variables" (
    "id",
    "key",
    "label",
    "description",
    "category",
    "example",
    "sortOrder",
    "active",
    "createdAt",
    "updatedAt"
)
VALUES (
    'simulation_reference',
    'SIMULATION_REFERENCE',
    'Simulation Reference',
    'Human-readable simulation reference number',
    'simulation',
    '00176/2026',
    105,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description",
    "category" = EXCLUDED."category",
    "example" = EXCLUDED."example",
    "sortOrder" = EXCLUDED."sortOrder",
    "active" = EXCLUDED."active",
    "updatedAt" = CURRENT_TIMESTAMP;
