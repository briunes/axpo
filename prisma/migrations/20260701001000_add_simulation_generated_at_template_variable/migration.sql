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
    "updatedAt",
    "commodity",
    "templateTypes"
) VALUES (
    'simulation_generated_at',
    'SIMULATION_GENERATED_AT',
    'Simulation Generated At',
    'Date and time when the simulation offers were last calculated',
    'simulation',
    '01/02/2026, 01:00:00',
    106,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    null,
    'simulation-output,simulation-detailed,simulation-share'
)
ON CONFLICT ("key") DO UPDATE SET
    "label" = EXCLUDED."label",
    "description" = EXCLUDED."description",
    "category" = EXCLUDED."category",
    "example" = EXCLUDED."example",
    "sortOrder" = EXCLUDED."sortOrder",
    "active" = EXCLUDED."active",
    "updatedAt" = CURRENT_TIMESTAMP,
    "commodity" = EXCLUDED."commodity",
    "templateTypes" = EXCLUDED."templateTypes";
