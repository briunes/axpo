-- Keep existing Spanish addresses aligned with the prefix-free province list.
UPDATE "clients"
SET "province" = regexp_replace(
  "province",
  '^(Province of|Província de|Provincia (da|de))[[:space:]]+',
  '',
  'i'
)
WHERE upper("country") = 'ES'
  AND "province" ~* '^(Province of|Província de|Provincia (da|de))[[:space:]]+';

UPDATE "agencies"
SET "province" = regexp_replace(
  "province",
  '^(Province of|Província de|Provincia (da|de))[[:space:]]+',
  '',
  'i'
)
WHERE upper("country") = 'ES'
  AND "province" ~* '^(Province of|Província de|Provincia (da|de))[[:space:]]+';
