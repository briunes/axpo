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
) VALUES
('var_elec_001', 'ELECTRICITY_TARIFF', 'Electricity Access Tariff', 'Electricity access tariff for the supply point', 'electricity', '3.0TD', 850, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_002', 'ELECTRICITY_ZONE', 'Electricity Zone', 'Geographic electricity pricing zone', 'electricity', 'Peninsula', 860, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_003', 'ELECTRICITY_PROFILE', 'Load Profile', 'Electricity load profile used in the simulation', 'electricity', 'NORMAL', 870, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_004', 'ELECTRICITY_BILLING_DAYS', 'Electricity Billing Days', 'Number of days in the electricity billing period', 'electricity', '31', 880, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_005', 'ELECTRICITY_CONSUMPTION_KWH', 'Electricity Period Consumption', 'Electricity consumption for the simulated billing period in kWh', 'electricity', '12.450', 890, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_006', 'ELECTRICITY_IVA_RATE', 'Electricity VAT Rate', 'VAT or IGIC rate applied to the electricity simulation', 'electricity', '21,00', 900, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_007', 'ELECTRICITY_TAX_RATE', 'Electricity Tax Rate', 'Electricity tax percentage rate applied to the simulation', 'electricity', '5,11269', 910, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_008', 'CURRENT_REACTIVE_COST', 'Current Reactive Cost', 'Reactive energy charge from the current electricity invoice', 'electricity', '12,45', 920, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed'),
('var_elec_009', 'CURRENT_OTHER_CHARGES', 'Current Other Charges', 'Other non-reactive charges from the current electricity invoice', 'electricity', '8,30', 930, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ELECTRICITY', 'simulation-output,simulation-detailed')
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
