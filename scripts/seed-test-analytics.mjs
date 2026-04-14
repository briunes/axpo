import pkg from "@prisma/client";
const { PrismaClient, UserRole, SimulationStatus } = pkg;
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// Helper to generate random dates
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to generate random PIN
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function main() {
  console.log("🌱 Seeding test data for analytics...\n");

  // Clean up existing test data first
  console.log("🧹 Cleaning up existing test data...");
  await prisma.accessAttempt.deleteMany({
    where: { simulation: { id: { startsWith: "test-sim-" } } }
  });
  await prisma.simulationVersion.deleteMany({
    where: { simulation: { id: { startsWith: "test-sim-" } } }
  });
  await prisma.simulation.deleteMany({
    where: { id: { startsWith: "test-sim-" } }
  });
  await prisma.client.deleteMany({
    where: { id: { startsWith: "test-client-" } }
  });
  await prisma.user.deleteMany({
    where: { id: { startsWith: "test-" } }
  });
  await prisma.agency.deleteMany({
    where: { id: { startsWith: "test-agency-" } }
  });
  console.log("   ✅ Cleanup complete\n");

  // ─── AGENCIES ─────────────────────────────────────────────────────────

  console.log("📍 Creating agencies...");
  
  const agencyMadrid = await prisma.agency.upsert({
    where: { id: "test-agency-madrid" },
    update: { name: "AXPO Madrid", isActive: true },
    create: {
      id: "test-agency-madrid",
      name: "AXPO Madrid",
      street: "Calle Gran Vía 28",
      city: "Madrid",
      postalCode: "28013",
      province: "Madrid",
      country: "España",
      isActive: true,
    },
  });

  const agencyBarcelona = await prisma.agency.upsert({
    where: { id: "test-agency-barcelona" },
    update: { name: "AXPO Barcelona", isActive: true },
    create: {
      id: "test-agency-barcelona",
      name: "AXPO Barcelona",
      street: "Passeig de Gràcia 85",
      city: "Barcelona",
      postalCode: "08008",
      province: "Barcelona",
      country: "España",
      isActive: true,
    },
  });

  const agencyValencia = await prisma.agency.upsert({
    where: { id: "test-agency-valencia" },
    update: { name: "AXPO Valencia", isActive: true },
    create: {
      id: "test-agency-valencia",
      name: "AXPO Valencia",
      street: "Avenida del Puerto 54",
      city: "Valencia",
      postalCode: "46021",
      province: "Valencia",
      country: "España",
      isActive: true,
    },
  });

  console.log(`   ✅ Created 3 agencies: ${agencyMadrid.name}, ${agencyBarcelona.name}, ${agencyValencia.name}\n`);

  // ─── USERS ────────────────────────────────────────────────────────────

  console.log("👥 Creating users...");

  const defaultPassword = await bcrypt.hash("Test1234!Axpo", 10);

  // Madrid - Agent + 3 Commercials
  const agentMadrid = await prisma.user.upsert({
    where: { email: "carlos.lopez@axpo-madrid.es" },
    update: { fullName: "Carlos López", role: UserRole.AGENT, agencyId: agencyMadrid.id },
    create: {
      id: "test-agent-madrid",
      agencyId: agencyMadrid.id,
      role: UserRole.AGENT,
      fullName: "Carlos López",
      email: "carlos.lopez@axpo-madrid.es",
      mobilePhone: "+34 600 123 456",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("1111", 10),
      pinCurrent: "1111",
      isActive: true,
    },
  });

  const commercial1Madrid = await prisma.user.upsert({
    where: { email: "ana.garcia@axpo-madrid.es" },
    update: { fullName: "Ana García", role: UserRole.COMMERCIAL, agencyId: agencyMadrid.id },
    create: {
      id: "test-commercial-madrid-1",
      agencyId: agencyMadrid.id,
      role: UserRole.COMMERCIAL,
      fullName: "Ana García",
      email: "ana.garcia@axpo-madrid.es",
      mobilePhone: "+34 600 234 567",
      commercialPhone: "+34 911 234 567",
      commercialEmail: "ana.garcia@axpo-madrid.es",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("2222", 10),
      pinCurrent: "2222",
      isActive: true,
    },
  });

  const commercial2Madrid = await prisma.user.upsert({
    where: { email: "javier.ruiz@axpo-madrid.es" },
    update: { fullName: "Javier Ruiz", role: UserRole.COMMERCIAL, agencyId: agencyMadrid.id },
    create: {
      id: "test-commercial-madrid-2",
      agencyId: agencyMadrid.id,
      role: UserRole.COMMERCIAL,
      fullName: "Javier Ruiz",
      email: "javier.ruiz@axpo-madrid.es",
      mobilePhone: "+34 600 345 678",
      commercialPhone: "+34 911 345 678",
      commercialEmail: "javier.ruiz@axpo-madrid.es",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("3333", 10),
      pinCurrent: "3333",
      isActive: true,
    },
  });

  const commercial3Madrid = await prisma.user.upsert({
    where: { email: "laura.martinez@axpo-madrid.es" },
    update: { fullName: "Laura Martínez", role: UserRole.COMMERCIAL, agencyId: agencyMadrid.id },
    create: {
      id: "test-commercial-madrid-3",
      agencyId: agencyMadrid.id,
      role: UserRole.COMMERCIAL,
      fullName: "Laura Martínez",
      email: "laura.martinez@axpo-madrid.es",
      mobilePhone: "+34 600 456 789",
      commercialPhone: "+34 911 456 789",
      commercialEmail: "laura.martinez@axpo-madrid.es",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("4444", 10),
      pinCurrent: "4444",
      isActive: true,
    },
  });

  // Barcelona - Agent + 4 Commercials
  const agentBarcelona = await prisma.user.upsert({
    where: { email: "maria.santos@axpo-barcelona.cat" },
    update: { fullName: "Maria Santos", role: UserRole.AGENT, agencyId: agencyBarcelona.id },
    create: {
      id: "test-agent-barcelona",
      agencyId: agencyBarcelona.id,
      role: UserRole.AGENT,
      fullName: "Maria Santos",
      email: "maria.santos@axpo-barcelona.cat",
      mobilePhone: "+34 600 567 890",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("5555", 10),
      pinCurrent: "5555",
      isActive: true,
    },
  });

  const commercial1Barcelona = await prisma.user.upsert({
    where: { email: "pau.fernandez@axpo-barcelona.cat" },
    update: { fullName: "Pau Fernández", role: UserRole.COMMERCIAL, agencyId: agencyBarcelona.id },
    create: {
      id: "test-commercial-barcelona-1",
      agencyId: agencyBarcelona.id,
      role: UserRole.COMMERCIAL,
      fullName: "Pau Fernández",
      email: "pau.fernandez@axpo-barcelona.cat",
      mobilePhone: "+34 600 678 901",
      commercialPhone: "+34 933 678 901",
      commercialEmail: "pau.fernandez@axpo-barcelona.cat",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("6666", 10),
      pinCurrent: "6666",
      isActive: true,
    },
  });

  const commercial2Barcelona = await prisma.user.upsert({
    where: { email: "nuria.vidal@axpo-barcelona.cat" },
    update: { fullName: "Núria Vidal", role: UserRole.COMMERCIAL, agencyId: agencyBarcelona.id },
    create: {
      id: "test-commercial-barcelona-2",
      agencyId: agencyBarcelona.id,
      role: UserRole.COMMERCIAL,
      fullName: "Núria Vidal",
      email: "nuria.vidal@axpo-barcelona.cat",
      mobilePhone: "+34 600 789 012",
      commercialPhone: "+34 933 789 012",
      commercialEmail: "nuria.vidal@axpo-barcelona.cat",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("7777", 10),
      pinCurrent: "7777",
      isActive: true,
    },
  });

  const commercial3Barcelona = await prisma.user.upsert({
    where: { email: "jordi.pujol@axpo-barcelona.cat" },
    update: { fullName: "Jordi Pujol", role: UserRole.COMMERCIAL, agencyId: agencyBarcelona.id },
    create: {
      id: "test-commercial-barcelona-3",
      agencyId: agencyBarcelona.id,
      role: UserRole.COMMERCIAL,
      fullName: "Jordi Pujol",
      email: "jordi.pujol@axpo-barcelona.cat",
      mobilePhone: "+34 600 890 123",
      commercialPhone: "+34 933 890 123",
      commercialEmail: "jordi.pujol@axpo-barcelona.cat",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("8888", 10),
      pinCurrent: "8888",
      isActive: true,
    },
  });

  const commercial4Barcelona = await prisma.user.upsert({
    where: { email: "montse.roca@axpo-barcelona.cat" },
    update: { fullName: "Montse Roca", role: UserRole.COMMERCIAL, agencyId: agencyBarcelona.id },
    create: {
      id: "test-commercial-barcelona-4",
      agencyId: agencyBarcelona.id,
      role: UserRole.COMMERCIAL,
      fullName: "Montse Roca",
      email: "montse.roca@axpo-barcelona.cat",
      mobilePhone: "+34 600 901 234",
      commercialPhone: "+34 933 901 234",
      commercialEmail: "montse.roca@axpo-barcelona.cat",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("9999", 10),
      pinCurrent: "9999",
      isActive: true,
    },
  });

  // Valencia - Agent + 2 Commercials
  const agentValencia = await prisma.user.upsert({
    where: { email: "vicente.soriano@axpo-valencia.es" },
    update: { fullName: "Vicente Soriano", role: UserRole.AGENT, agencyId: agencyValencia.id },
    create: {
      id: "test-agent-valencia",
      agencyId: agencyValencia.id,
      role: UserRole.AGENT,
      fullName: "Vicente Soriano",
      email: "vicente.soriano@axpo-valencia.es",
      mobilePhone: "+34 600 012 345",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("1010", 10),
      pinCurrent: "1010",
      isActive: true,
    },
  });

  const commercial1Valencia = await prisma.user.upsert({
    where: { email: "carmen.blasco@axpo-valencia.es" },
    update: { fullName: "Carmen Blasco", role: UserRole.COMMERCIAL, agencyId: agencyValencia.id },
    create: {
      id: "test-commercial-valencia-1",
      agencyId: agencyValencia.id,
      role: UserRole.COMMERCIAL,
      fullName: "Carmen Blasco",
      email: "carmen.blasco@axpo-valencia.es",
      mobilePhone: "+34 600 123 456",
      commercialPhone: "+34 963 123 456",
      commercialEmail: "carmen.blasco@axpo-valencia.es",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("1212", 10),
      pinCurrent: "1212",
      isActive: true,
    },
  });

  const commercial2Valencia = await prisma.user.upsert({
    where: { email: "sergio.navarro@axpo-valencia.es" },
    update: { fullName: "Sergio Navarro", role: UserRole.COMMERCIAL, agencyId: agencyValencia.id },
    create: {
      id: "test-commercial-valencia-2",
      agencyId: agencyValencia.id,
      role: UserRole.COMMERCIAL,
      fullName: "Sergio Navarro",
      email: "sergio.navarro@axpo-valencia.es",
      mobilePhone: "+34 600 234 567",
      commercialPhone: "+34 963 234 567",
      commercialEmail: "sergio.navarro@axpo-valencia.es",
      passwordHash: defaultPassword,
      pinHash: await bcrypt.hash("1313", 10),
      pinCurrent: "1313",
      isActive: true,
    },
  });

  console.log(`   ✅ Created 12 users across 3 agencies\n`);

  // ─── CLIENTS ──────────────────────────────────────────────────────────

  console.log("🏢 Creating clients...");

  const clients = [];

  // Madrid clients (8)
  const madridClients = [
    { name: "Industrias Metalúrgicas del Centro S.L.", cif: "B12345678", contact: "Pedro Gómez", email: "pedro@metalurgicas.es", phone: "+34 911 111 111" },
    { name: "Distribuciones Alimentarias Madrid S.A.", cif: "A23456789", contact: "Isabel Fernández", email: "isabel@distrimadrid.es", phone: "+34 911 222 222" },
    { name: "Grupo Hotelero Capital", cif: "B34567890", contact: "Roberto Sánchez", email: "roberto@ghcapital.es", phone: "+34 911 333 333" },
    { name: "Textiles y Confección del Sur S.L.", cif: "B45678901", contact: "Elena Moreno", email: "elena@textilessur.es", phone: "+34 911 444 444" },
    { name: "Servicios Logísticos Ibéricos", cif: "A56789012", contact: "Miguel Ángel Ramos", email: "ma.ramos@logiberica.es", phone: "+34 911 555 555" },
    { name: "Construcciones y Reformas MCM", cif: "B67890123", contact: "Francisco Jiménez", email: "fjimenez@mcm.es", phone: "+34 911 666 666" },
    { name: "Centro Deportivo Premium Madrid", cif: "B78901234", contact: "Cristina Vega", email: "cvega@cdpmadrid.es", phone: "+34 911 777 777" },
    { name: "Farmacéuticas Unidas del Centro", cif: "A89012345", contact: "Beatriz Castro", email: "bcastro@farmacentro.es", phone: "+34 911 888 888" },
  ];

  for (const [idx, client] of madridClients.entries()) {
    const c = await prisma.client.upsert({
      where: { id: `test-client-madrid-${idx + 1}` },
      update: {},
      create: {
        id: `test-client-madrid-${idx + 1}`,
        agencyId: agencyMadrid.id,
        name: client.name,
        cif: client.cif,
        contactName: client.contact,
        contactEmail: client.email,
        contactPhone: client.phone,
        isActive: true,
      },
    });
    clients.push(c);
  }

  // Barcelona clients (10)
  const barcelonaClients = [
    { name: "Tecnologías Digitales BCN S.L.", cif: "B90123456", contact: "Marc Puig", email: "marc@techbcn.cat", phone: "+34 933 111 111" },
    { name: "Importaciones del Mediterráneo", cif: "A01234567", contact: "Carla Soler", email: "csoler@importmed.cat", phone: "+34 933 222 222" },
    { name: "Restaurantes y Catering Barcelona", cif: "B12340001", contact: "DavidFont", email: "dfont@rcbcn.cat", phone: "+34 933 333 333" },
    { name: "Industrias Químicas Catalanas", cif: "A23450002", contact: "Anna Rovira", email: "arovira@iqc.cat", phone: "+34 933 444 444" },
    { name: "Transporte Express Catalunya", cif: "B34560003", contact: "Enric Sala", email: "esala@texpress.cat", phone: "+34 933 555 555" },
    { name: "Energías Renovables del Noreste", cif: "A45670004", contact: "Silvia Camps", email: "scamps@ernoreste.cat", phone: "+34 933 666 666" },
    { name: "Consultoría Empresarial Barcelona", cif: "B56780005", contact: "Albert Mir", email: "amir@cebarcelona.cat", phone: "+34 933 777 777" },
    { name: "Manufacturas Textiles Catalanas", cif: "B67890006", contact: "Rosa Valls", email: "rvalls@mtcatalanas.cat", phone: "+34 933 888 888" },
    { name: "Comercial de Electrodomésticos BCN", cif: "A78900007", contact: "Josep Mas", email: "jmas@electrobcn.cat", phone: "+34 933 999 999" },
    { name: "Asesoría Fiscal y Legal Costa Brava", cif: "B89010008", contact: "Marta Serra", email: "mserra@aflcostabrava.cat", phone: "+34 933 000 000" },
  ];

  for (const [idx, client] of barcelonaClients.entries()) {
    const c = await prisma.client.upsert({
      where: { id: `test-client-barcelona-${idx + 1}` },
      update: {},
      create: {
        id: `test-client-barcelona-${idx + 1}`,
        agencyId: agencyBarcelona.id,
        name: client.name,
        cif: client.cif,
        contactName: client.contact,
        contactEmail: client.email,
        contactPhone: client.phone,
        isActive: true,
      },
    });
    clients.push(c);
  }

  // Valencia clients (6)
  const valenciaClients = [
    { name: "Navieras del Levante S.A.", cif: "A90120009", contact: "Antonio Pérez", email: "aperez@navieras.es", phone: "+34 963 111 111" },
    { name: "Agrícola Valenciana Cooperativa", cif: "B01230010", contact: "Amparo Gil", email: "agil@agricolaval.es", phone: "+34 963 222 222" },
    { name: "Centro Comercial Valencia Norte", cif: "A12340011", contact: "Rafael Soler", email: "rsoler@ccvnorte.es", phone: "+34 963 333 333" },
    { name: "Envases y Embalajes del Este", cif: "B23450012", contact: "Lucía Molina", email: "lmolina@envaseste.es", phone: "+34 963 444 444" },
    { name: "Clínica Dental Valencia Centro", cif: "B34560013", contact: "Fernando Ortiz", email: "fortiz@dentalvalencia.es", phone: "+34 963 555 555" },
    { name: "Muebles y Decoración Mediterráneo", cif: "A45670014", contact: "Teresa Campos", email: "tcampos@mueblesmed.es", phone: "+34 963 666 666" },
  ];

  for (const [idx, client] of valenciaClients.entries()) {
    const c = await prisma.client.upsert({
      where: { id: `test-client-valencia-${idx + 1}` },
      update: {},
      create: {
        id: `test-client-valencia-${idx + 1}`,
        agencyId: agencyValencia.id,
        name: client.name,
        cif: client.cif,
        contactName: client.contact,
        contactEmail: client.email,
        contactPhone: client.phone,
        isActive: true,
      },
    });
    clients.push(c);
  }

  console.log(`   ✅ Created 24 clients (8 Madrid, 10 Barcelona, 6 Valencia)\n`);

  // ─── SIMULATIONS ──────────────────────────────────────────────────────

  console.log("📊 Creating simulations...");

  const now = new Date();
  const past90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const past60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const commercials = [
    { user: commercial1Madrid, agency: agencyMadrid, clients: clients.slice(0, 8) },
    { user: commercial2Madrid, agency: agencyMadrid, clients: clients.slice(0, 8) },
    { user: commercial3Madrid, agency: agencyMadrid, clients: clients.slice(0, 8) },
    { user: commercial1Barcelona, agency: agencyBarcelona, clients: clients.slice(8, 18) },
    { user: commercial2Barcelona, agency: agencyBarcelona, clients: clients.slice(8, 18) },
    { user: commercial3Barcelona, agency: agencyBarcelona, clients: clients.slice(8, 18) },
    { user: commercial4Barcelona, agency: agencyBarcelona, clients: clients.slice(8, 18) },
    { user: commercial1Valencia, agency: agencyValencia, clients: clients.slice(18, 24) },
    { user: commercial2Valencia, agency: agencyValencia, clients: clients.slice(18, 24) },
  ];

  let simCount = 0;
  let sharedCount = 0;
  let accessCount = 0;

  for (const commercial of commercials) {
    // Each commercial creates 8-15 simulations
    const numSims = Math.floor(8 + Math.random() * 8);

    for (let i = 0; i < numSims; i++) {
      const createdAt = randomDate(past90Days, now);
      const client = commercial.clients[Math.floor(Math.random() * commercial.clients.length)];
      
      // 70% are shared, 30% stay as draft
      const isShared = Math.random() > 0.3;
      const status = isShared ? SimulationStatus.SHARED : SimulationStatus.DRAFT;
      
      const publicToken = isShared ? crypto.randomBytes(32).toString("hex") : null;
      const sharedAt = isShared ? new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null;
      
      const pinSnapshot = commercial.user.pinCurrent;
      const pinHashSnapshot = commercial.user.pinHash;

      const simulation = await prisma.simulation.create({
        data: {
          id: `test-sim-${++simCount}`,
          agencyId: commercial.agency.id,
          ownerUserId: commercial.user.id,
          clientId: client.id,
          status: status,
          publicToken: publicToken,
          pinSnapshot: pinSnapshot,
          pinHashSnapshot: pinHashSnapshot,
          sharedAt: sharedAt,
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });

      // Create a version for the simulation with proper payload structure
      const isElectricity = Math.random() > 0.3; // 70% electricity, 30% gas
      const tarifa = isElectricity ? "2.0TD" : "RL.1";
      const consumoAnual = Math.floor(2000 + Math.random() * 18000);
      
      const { fechaInicio, fechaFin } = (() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          fechaInicio: firstDay.toISOString().slice(0, 10),
          fechaFin: lastDay.toISOString().slice(0, 10),
        };
      })();
      
      const dias = Math.round((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / 86400000);

      const payloadJson = isElectricity ? {
        schemaVersion: "1",
        type: "ELECTRICITY",
        electricity: {
          clientData: {
            cups: `ES${Math.random().toString(36).substring(2, 18).toUpperCase()}`,
            consumoAnual: consumoAnual,
            nombreTitular: client.name,
            personaContacto: client.contactName,
            comercial: commercial.user.fullName,
            direccion: client.contactPhone,
            comercializadorActual: "Iberdrola",
          },
          tarifaAcceso: "2.0TD",
          zonaGeografica: "Peninsula",
          perfilCarga: "NORMAL",
          potenciaContratada: {
            P1: parseFloat((3.0 + Math.random() * 7).toFixed(2)),
            P2: parseFloat((3.0 + Math.random() * 7).toFixed(2)),
          },
          excesoPotencia: {},
          consumo: {
            P1: Math.floor(consumoAnual * 0.3),
            P2: Math.floor(consumoAnual * 0.4),
            P3: Math.floor(consumoAnual * 0.3),
          },
          omieEstimado: {
            P1: parseFloat((0.08 + Math.random() * 0.04).toFixed(4)),
            P2: parseFloat((0.07 + Math.random() * 0.03).toFixed(4)),
            P3: parseFloat((0.06 + Math.random() * 0.02).toFixed(4)),
          },
          periodo: { fechaInicio, fechaFin, dias },
          facturaActual: parseFloat((consumoAnual * 0.12 / 12).toFixed(2)),
          extras: {
            reactiva: 0,
            alquilerEquipoMedida: 0.8,
            otrosCargos: 0,
          },
        },
      } : {
        schemaVersion: "1",
        type: "GAS",
        gas: {
          tarifaAcceso: "RL.1",
          zonaGeografica: "ZONA_1",
          consumo: consumoAnual,
          telemedida: Math.random() > 0.7 ? "SI" : "NO",
          periodo: { fechaInicio, fechaFin, dias },
          facturaActual: parseFloat((consumoAnual * 0.06 / 12).toFixed(2)),
          extras: {
            alquilerEquipoMedida: 0.6,
            otrosCargos: 0,
          },
        },
      };

      await prisma.simulationVersion.create({
        data: {
          simulationId: simulation.id,
          payloadJson: payloadJson,
          createdBy: commercial.user.id,
          createdAt: createdAt,
        },
      });

      if (isShared) {
        sharedCount++;

        // 60% of shared simulations get accessed
        if (Math.random() > 0.4) {
          const numAttempts = Math.floor(1 + Math.random() * 3); // 1-3 attempts
          
          for (let a = 0; a < numAttempts; a++) {
            const attemptDate = new Date(sharedAt.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000);
            
            // First attempt is usually successful, others might fail
            const isSuccessful = a === 0 ? true : Math.random() > 0.3;
            
            await prisma.accessAttempt.create({
              data: {
                simulationId: simulation.id,
                success: isSuccessful,
                reason: isSuccessful ? "SUCCESS" : "INVALID_PIN",
                ipHashOrMask: `192.168.${Math.floor(Math.random() * 255)}.xxx`,
                tokenFragment: publicToken ? publicToken.substring(0, 8) : null,
                createdAt: attemptDate,
              },
            });

            if (isSuccessful) {
              accessCount++;
            }
          }
        }
      }
    }
  }

  console.log(`   ✅ Created ${simCount} simulations`);
  console.log(`   ✅ ${sharedCount} shared, ${simCount - sharedCount} drafts`);
  console.log(`   ✅ ${accessCount} successful accesses\n`);

  console.log("✨ Test data seeding complete!\n");
  console.log("📊 Summary:");
  console.log(`   • 3 agencies (Madrid, Barcelona, Valencia)`);
  console.log(`   • 3 agents (1 per agency)`);
  console.log(`   • 9 commercials (3 Madrid, 4 Barcelona, 2 Valencia)`);
  console.log(`   • 24 clients (8 Madrid, 10 Barcelona, 6 Valencia)`);
  console.log(`   • ${simCount} simulations (${sharedCount} shared, ${simCount - sharedCount} drafts)`);
  console.log(`   • ${accessCount} successful client accesses\n`);
  console.log("⚙️  Run calculations: Log in and click 'Calculate' on simulations to generate offers\n");
  console.log("🔐 All users have password: Test1234!Axpo\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
