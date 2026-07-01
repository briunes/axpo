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
    'user_agency',
    'USER_AGENCY',
    'User Agency',
    'Agency name associated with the user',
    'user',
    'Axpo Madrid',
    220,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    null,
    'simulation-output,simulation-detailed,simulation-share,user-welcome,welcome,password-reset,magic-link,otp'
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
