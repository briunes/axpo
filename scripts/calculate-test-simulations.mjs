/**
 * Calculate test simulations and select random offers
 * Run this AFTER seed-test-analytics.mjs
 * Requires the dev server to be running (pnpm dev)
 */

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const API_BASE = "http://localhost:3000/api/v1/internal";

// Get admin token by logging in
async function getAdminToken() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@axpo.local",
      password: "AxpoAdmin#2026",
    }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to login as admin");
  }
  
  const data = await response.json();
  return data.data.token;
}

// Calculate a simulation
async function calculateSimulation(token, simulationId) {
  const response = await fetch(`${API_BASE}/simulations/${simulationId}/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calculation failed: ${error}`);
  }
  
  return response.json();
}

// Select a random offer
async function selectOffer(token, simulationId, productKey, commodity, pricingType) {
  // Fetch latest simulation data from API
  const getResponse = await fetch(`${API_BASE}/simulations/${simulationId}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!getResponse.ok) {
    throw new Error("Failed to fetch simulation");
  }
  
  const simData = await getResponse.json();
  const payload = simData.data.simulation.payloadJson;
  
  const updatedPayload = {
    ...payload,
    selectedOffer: {
      productKey,
      commodity,
      pricingType,
      selectedAt: new Date().toISOString(),
    },
  };
  
  const response = await fetch(`${API_BASE}/simulations/${simulationId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ payloadJson: updatedPayload }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update simulation: ${errorText}`);
  }
  
  return response.json();
}

async function main() {
  console.log("🧮 Calculating test simulations...\n");
  
  // Get admin token
  console.log("🔐 Logging in as admin...");
  const token = await getAdminToken();
  console.log("   ✅ Logged in\n");
  
  // Get all test simulations that are shared
  const simulations = await prisma.simulation.findMany({
    where: {
      id: { startsWith: "test-sim-" },
      status: "SHARED",
    },
    orderBy: { createdAt: "asc" },
  });
  
  console.log(`📊 Found ${simulations.length} shared test simulations\n`);
  
  let calculatedCount = 0;
  let selectedCount = 0;
  let failedCount = 0;
  
  // Calculate 70% of shared simulations
  const simsToCalculate = simulations.slice(0, Math.floor(simulations.length * 0.7));
  
  for (const [index, sim] of simsToCalculate.entries()) {
    try {
      console.log(`   [${index + 1}/${simsToCalculate.length}] Calculating ${sim.id}...`);
      
      const result = await calculateSimulation(token, sim.id);
      calculatedCount++;
      
      // Select random offer for 80% of calculated simulations
      if (Math.random() > 0.2) {
        const allProducts = [
          ...(result.data.results.electricity || []),
          ...(result.data.results.gas || []),
        ];
        
        if (allProducts.length > 0) {
          const randomProduct = allProducts[Math.floor(Math.random() * allProducts.length)];
          
          // Update database directly - get latest version and add selectedOffer
          const latestVersion = await prisma.simulationVersion.findFirst({
            where: { simulationId: sim.id },
            orderBy: { createdAt: "desc" },
          });
          
          const updatedPayload = {
            ...latestVersion.payloadJson,
            selectedOffer: {
              productKey: randomProduct.productKey,
              commodity: randomProduct.commodity,
              pricingType: randomProduct.pricingType,
              selectedAt: new Date().toISOString(),
            },
          };
          
          await prisma.simulationVersion.update({
            where: { id: latestVersion.id },
            data: { payloadJson: updatedPayload },
          });
          
          selectedCount++;
          console.log(`      ✓ Selected: ${randomProduct.productKey}`);
        }
      } else {
        console.log(`      ✓ Calculated (no selection)`);
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      failedCount++;
      console.error(`      ✗ Failed: ${err.message}`);
    }
  }
  
  console.log("\n✨ Calculation complete!\n");
  console.log("📊 Summary:");
  console.log(`   • ${calculatedCount} simulations calculated`);
  console.log(`   • ${selectedCount} offers selected`);
  console.log(`   • ${failedCount} failed\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
