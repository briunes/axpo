INSERT INTO "template_variables" (
    "id",
    "key",
    "label",
    "description",
    "category",
    "example",
    "sortOrder",
    "active",
    "templateTypes",
    "createdAt",
    "updatedAt"
)
VALUES (
    'setup_password_validity_hours',
    'SETUP_PASSWORD_VALIDITY_HOURS',
    'Setup Password Validity Hours',
    'Configured number of hours the setup-password link remains valid',
    'user',
    '72',
    245,
    true,
    'user-welcome,welcome',
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
    "templateTypes" = EXCLUDED."templateTypes",
    "updatedAt" = CURRENT_TIMESTAMP;
