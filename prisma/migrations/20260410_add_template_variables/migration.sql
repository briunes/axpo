-- CreateTable
CREATE TABLE "template_variables" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "example" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_variables_key_key" ON "template_variables"("key");

-- Insert default template variables
INSERT INTO "template_variables" ("id", "key", "label", "description", "category", "example", "sortOrder", "active", "createdAt", "updatedAt") VALUES
('var_001', 'CLIENT_NAME', 'Client Name', 'The company or client name', 'client', 'Juvacam SL', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_002', 'CLIENT_ADDRESS', 'Client Address', 'Full client address', 'client', 'C de los Dominicos, 6, 47001 Valladolid', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_003', 'CUPS_NUMBER', 'CUPS Number', 'CUPS identifier', 'client', 'ES0031352682800001VB', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('var_004', 'SIMULATION_ID', 'Simulation ID', 'Unique simulation identifier', 'simulation', 'sim-001', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_005', 'SIMULATION_PERIOD', 'Simulation Period', 'Date range of simulation', 'simulation', '30/11/2025 — 31/12/2025', 110, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_006', 'CREATED_AT', 'Created Date', 'Simulation creation date', 'simulation', '01/12/2025', 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_007', 'EXPIRES_AT', 'Expiration Date', 'Simulation expiration date', 'simulation', '31/01/2026', 130, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_008', 'STATUS', 'Simulation Status', 'Current status', 'simulation', 'SHARED', 140, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('var_009', 'OWNER_NAME', 'Owner Name', 'Simulation owner full name', 'user', 'María García', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_010', 'OWNER_EMAIL', 'Owner Email', 'Simulation owner email', 'user', 'maria.garcia@fiva.com', 210, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('var_011', 'PRODUCT_NAME', 'Product Name', 'Selected product/plan name', 'calculation', 'Personalizada Index', 300, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_012', 'ANNUAL_CONSUMPTION', 'Annual Consumption', 'Estimated annual consumption in kWh', 'calculation', '1.633,187', 310, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Power periods
('var_013', 'CURRENT_POWER_P1', 'Current Power P1', 'Contracted power period 1 (kW)', 'period', '0,0851', 400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_014', 'CURRENT_POWER_P2', 'Current Power P2', 'Contracted power period 2 (kW)', 'period', '0,0851', 401, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_015', 'CURRENT_POWER_P3', 'Current Power P3', 'Contracted power period 3 (kW)', 'period', '0,0851', 402, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_016', 'CURRENT_POWER_P4', 'Current Power P4', 'Contracted power period 4 (kW)', 'period', '0,0851', 403, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_017', 'CURRENT_POWER_P5', 'Current Power P5', 'Contracted power period 5 (kW)', 'period', '0,0851', 404, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_018', 'CURRENT_POWER_P6', 'Current Power P6', 'Contracted power period 6 (kW)', 'period', '0,0851', 405, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Energy periods
('var_019', 'CURRENT_ENERGY_P1', 'Current Energy P1', 'Energy consumption period 1 (kWh)', 'period', '120', 410, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_020', 'CURRENT_ENERGY_P2', 'Current Energy P2', 'Energy consumption period 2 (kWh)', 'period', '150', 411, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_021', 'CURRENT_ENERGY_P3', 'Current Energy P3', 'Energy consumption period 3 (kWh)', 'period', '180', 412, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_022', 'CURRENT_ENERGY_P4', 'Current Energy P4', 'Energy consumption period 4 (kWh)', 'period', '—', 413, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_023', 'CURRENT_ENERGY_P5', 'Current Energy P5', 'Energy consumption period 5 (kWh)', 'period', '—', 414, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_024', 'CURRENT_ENERGY_P6', 'Current Energy P6', 'Energy consumption period 6 (kWh)', 'period', '200', 415, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Current plan costs
('var_025', 'CURRENT_POWER_COST', 'Current Power Cost', 'Power term cost (€)', 'calculation', '2.123,86', 500, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_026', 'CURRENT_ENERGY_COST', 'Current Energy Cost', 'Energy term cost (€)', 'calculation', '22.304,70', 510, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_027', 'CURRENT_EXCESS_COST', 'Current Excess Cost', 'Excess power charges (€)', 'calculation', '0', 520, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_028', 'CURRENT_TAX_COST', 'Current Tax Cost', 'Tax charges (€)', 'calculation', '1.256,47', 530, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_029', 'CURRENT_OTHER_COST', 'Current Other Cost', 'Other charges (€)', 'calculation', '150,90', 540, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_030', 'CURRENT_RENTAL_COST', 'Current Rental Cost', 'Equipment rental (€)', 'calculation', '15,50', 550, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_031', 'CURRENT_VAT', 'Current VAT', 'VAT amount (€)', 'calculation', '5.427,44', 560, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_032', 'CURRENT_TOTAL', 'Current Total', 'Total current invoice (€)', 'calculation', '36.272,36', 570, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- AXPO plan (same structure)
('var_033', 'AXPO_POWER_P1', 'AXPO Power P1', 'AXPO contracted power P1 (kW)', 'period', '0,0851', 600, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_034', 'AXPO_POWER_P2', 'AXPO Power P2', 'AXPO contracted power P2 (kW)', 'period', '0,0851', 601, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_035', 'AXPO_POWER_P3', 'AXPO Power P3', 'AXPO contracted power P3 (kW)', 'period', '0,0851', 602, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_036', 'AXPO_POWER_P4', 'AXPO Power P4', 'AXPO contracted power P4 (kW)', 'period', '0,0851', 603, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_037', 'AXPO_POWER_P5', 'AXPO Power P5', 'AXPO contracted power P5 (kW)', 'period', '0,0851', 604, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_038', 'AXPO_POWER_P6', 'AXPO Power P6', 'AXPO contracted power P6 (kW)', 'period', '0,0851', 605, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('var_039', 'AXPO_ENERGY_P1', 'AXPO Energy P1', 'AXPO energy consumption P1 (kWh)', 'period', '120', 610, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_040', 'AXPO_ENERGY_P2', 'AXPO Energy P2', 'AXPO energy consumption P2 (kWh)', 'period', '150', 611, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_041', 'AXPO_ENERGY_P3', 'AXPO Energy P3', 'AXPO energy consumption P3 (kWh)', 'period', '180', 612, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_042', 'AXPO_ENERGY_P4', 'AXPO Energy P4', 'AXPO energy consumption P4 (kWh)', 'period', '—', 613, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_043', 'AXPO_ENERGY_P5', 'AXPO Energy P5', 'AXPO energy consumption P5 (kWh)', 'period', '—', 614, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_044', 'AXPO_ENERGY_P6', 'AXPO Energy P6', 'AXPO energy consumption P6 (kWh)', 'period', '200', 615, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('var_045', 'AXPO_POWER_COST', 'AXPO Power Cost', 'AXPO power term cost (€)', 'calculation', '2.123,86', 700, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_046', 'AXPO_ENERGY_COST', 'AXPO Energy Cost', 'AXPO energy term cost (€)', 'calculation', '22.304,70', 710, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_047', 'AXPO_EXCESS_COST', 'AXPO Excess Cost', 'AXPO excess power charges (€)', 'calculation', '0', 720, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_048', 'AXPO_TAX_COST', 'AXPO Tax Cost', 'AXPO tax charges (€)', 'calculation', '1.256,47', 730, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_049', 'AXPO_OTHER_COST', 'AXPO Other Cost', 'AXPO other charges (€)', 'calculation', '150,90', 740, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_050', 'AXPO_RENTAL_COST', 'AXPO Rental Cost', 'AXPO equipment rental (€)', 'calculation', '15,50', 750, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_051', 'AXPO_VAT', 'AXPO VAT', 'AXPO VAT amount (€)', 'calculation', '5.427,44', 760, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var_052', 'AXPO_TOTAL', 'AXPO Total', 'AXPO total invoice (€)', 'calculation', '31.272,38', 770, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('var_053', 'SAVINGS_AMOUNT', 'Savings Amount', 'Calculated savings amount (€)', 'calculation', '5.000,00', 800, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
