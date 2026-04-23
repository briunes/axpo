import pkg from "@prisma/client";
const { PrismaClient, UserRole } = pkg;
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function ensureClient(data) {
  const existing = await prisma.client.findFirst({
    where: { cif: data.cif, agencyId: data.agencyId },
  });
  if (!existing) await prisma.client.create({ data });
}

async function main() {
  let agency = await prisma.agency.findFirst({ where: { name: "AXPO Seed Agency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "AXPO Seed Agency", isActive: true } });
  } else {
    agency = await prisma.agency.update({ where: { id: agency.id }, data: { isActive: true } });
  }

  const [adminPin, agentPin, commercialPin, adminPassword, agentPassword, commercialPassword] = await Promise.all([
    bcrypt.hash("1234", 10),
    bcrypt.hash("2345", 10),
    bcrypt.hash("3456", 10),
    bcrypt.hash("AxpoAdmin#2026", 10),
    bcrypt.hash("AxpoAgent#2026", 10),
    bcrypt.hash("AxpoCommercial#2026", 10),
  ]);

  await prisma.user.upsert({
    where: { email: "admin@axpo.local" },
    update: {
      fullName: "Seed Admin",
      role: UserRole.ADMIN,
      agencyId: agency.id,
      passwordHash: adminPassword,
      pinHash: adminPin,
      isActive: true,
    },
    create: {
      agencyId: agency.id,
      role: UserRole.ADMIN,
      fullName: "Seed Admin",
      email: "admin@axpo.local",
      passwordHash: adminPassword,
      pinHash: adminPin,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "agent@axpo.local" },
    update: {
      fullName: "Seed Agent",
      role: UserRole.AGENT,
      agencyId: agency.id,
      passwordHash: agentPassword,
      pinHash: agentPin,
      isActive: true,
    },
    create: {
      agencyId: agency.id,
      role: UserRole.AGENT,
      fullName: "Seed Agent",
      email: "agent@axpo.local",
      passwordHash: agentPassword,
      pinHash: agentPin,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "commercial@axpo.local" },
    update: {
      fullName: "Seed Commercial",
      role: UserRole.COMMERCIAL,
      agencyId: agency.id,
      passwordHash: commercialPassword,
      pinHash: commercialPin,
      isActive: true,
    },
    create: {
      agencyId: agency.id,
      role: UserRole.COMMERCIAL,
      fullName: "Seed Commercial",
      email: "commercial@axpo.local",
      passwordHash: commercialPassword,
      pinHash: commercialPin,
      isActive: true,
    },
  });

  // Seed clients
  await ensureClient({ agencyId: agency.id, name: "Industrias Mediterráneas S.L.", cif: "B12345678", contactName: "María García López", contactEmail: "maria.garcia@industriasmed.es", contactPhone: "+34 915 123 456", otherDetails: "Cliente industrial con alto consumo energético", isActive: true });
  await ensureClient({ agencyId: agency.id, name: "Comercial Levante S.A.", cif: "A87654321", contactName: "Juan Martínez Sánchez", contactEmail: "juan.martinez@comerciallevante.com", contactPhone: "+34 963 987 654", otherDetails: "Cadena de tiendas con múltiples puntos de suministro", isActive: true });
  await ensureClient({ agencyId: agency.id, name: "Hotel Costa Blanca Group", cif: "B23456789", contactName: "Carmen Ruiz Fernández", contactEmail: "carmen.ruiz@costablancahotels.es", contactPhone: "+34 965 234 567", otherDetails: "Grupo hotelero con necesidades de eficiencia energética", isActive: true });
  await ensureClient({ agencyId: agency.id, name: "Tecnología y Servicios Barcelona S.L.", cif: "B34567890", contactName: "Pedro López Gómez", contactEmail: "pedro.lopez@tecnoservi.cat", contactPhone: "+34 933 456 789", otherDetails: "Empresa tecnológica en fase de expansión", isActive: true });
  await ensureClient({ agencyId: agency.id, name: "Alimentación Castilla La Mancha", cif: "B45678901", contactName: "Ana Jiménez Torres", contactEmail: "ana.jimenez@alimentacionclm.es", contactPhone: "+34 925 567 890", otherDetails: "Distribuidor regional de productos alimenticios", isActive: true });

  console.log("✓ Seeded 5 clients");

  // Seed email templates
  await prisma.emailTemplate.upsert({
    where: { id: "user-welcome-default" },
    update: {},
    create: {
      id: "user-welcome-default",
      name: "User Welcome Email",
      description: "Default welcome email sent when a new user is created",
      type: "user-welcome",
      active: true,
      subject: "Welcome to AXPO Simulator - Your Account Has Been Created",
      htmlContent: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #dc2626;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9fafb;
            padding: 30px;
            border-radius: 0 0 5px 5px;
        }
        .credentials {
            background-color: #fff;
            border-left: 4px solid #dc2626;
            padding: 15px;
            margin: 20px 0;
        }
        .credentials h3 {
            margin-top: 0;
            color: #dc2626;
        }
        .info-item {
            margin: 10px 0;
        }
        .info-label {
            font-weight: bold;
            color: #6b7280;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to AXPO Simulator</h1>
    </div>
    <div class="content">
        <p>Hello <strong>{{ USER_NAME }}</strong>,</p>
        
        <p>Your account has been successfully created in the AXPO Simulator system. You can now access the platform using the credentials provided below.</p>
        
        <div class="credentials">
            <h3>Your Login Credentials</h3>
            <div class="info-item">
                <span class="info-label">Email:</span> {{ USER_EMAIL }}
            </div>
            <div class="info-item">
                <span class="info-label">Password:</span> {{ USER_PASSWORD }}
            </div>
            <div class="info-item">
                <span class="info-label">PIN:</span> {{ USER_PIN }}
            </div>
        </div>
        
        <p><strong>Important:</strong> For security reasons, please change your password after your first login.</p>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact your administrator.</p>
        
        <p>Best regards,<br>The AXPO Simulator Team</p>
    </div>
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>`,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { id: "simulation-share-default" },
    update: {},
    create: {
      id: "simulation-share-default",
      name: "Simulation Share Email",
      description: "Email template for sharing simulation results with clients",
      type: "simulation-share",
      active: true,
      subject: "Your AXPO Energy Simulation is Ready",
      htmlContent: `<!DOCTYPE html>
<html>
<head>
    <style>
        .email-wrapper { font-family: Arial, sans-serif; line-height: 1.6; color: #374151; }
        .email-container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .email-header { background: #dc2626; color: white; padding: 30px; text-align: center; }
        .email-content { padding: 30px; background: #f9fafb; }
        .email-button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .email-footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <h1>AXPO Energy Solutions</h1>
            </div>
            <div class="email-content">
                <p>Dear {{CONTACT_PERSON}},</p>
                <p>Thank you for your interest in AXPO energy solutions.</p>
                <p>We have prepared a personalized energy simulation for <strong>{{CLIENT_NAME}}</strong>. You can view the detailed results by clicking the link below:</p>
                <p style="text-align: center;">
                    <a href="{{SIMULATION_LINK}}" class="email-button">View Simulation</a>
                </p>
                <p>Your access PIN is: <strong>{{PIN}}</strong></p>
                <p>This simulation will be available for {{EXPIRES_IN_DAYS}} days.</p>
                <p>Best regards,<br>{{OWNER_NAME}}<br>{{OWNER_EMAIL}}<br>{{OWNER_PHONE}}</p>
            </div>
            <div class="email-footer">
                © 2026 AXPO Energy Solutions. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>`,
    },
  });

  // Seed PDF templates
  await prisma.pdfTemplate.upsert({
    where: { id: "simulation-output-default" },
    update: {},
    create: {
      id: "simulation-output-default",
      name: "Simulation Output - Default",
      description: "Standard simulation output template with product details and comparison",
      type: "simulation-output",
      commodity: "ELECTRICITY",
      active: true,
      htmlContent: `<style>
  #axpo-sim-tpl {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #333;
    padding: 20px;
    background: #ffffff;
    box-sizing: border-box;
  }
  #axpo-sim-tpl * { box-sizing: border-box; margin: 0; padding: 0; }
  #axpo-sim-tpl .asim-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
  #axpo-sim-tpl .asim-greeting { font-size: 24pt; font-weight: bold; color: #E91E63; margin-bottom: 10px; }
  #axpo-sim-tpl .asim-intro { font-size: 9pt; color: #666; line-height: 1.6; max-width: 500px; margin-top: 15px; margin-bottom: 30px; }
  #axpo-sim-tpl .asim-basic-data { margin-bottom: 30px; }
  #axpo-sim-tpl .asim-section-title { font-size: 12pt; font-weight: bold; color: #E91E63; margin-bottom: 15px; }
  #axpo-sim-tpl .asim-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
  #axpo-sim-tpl .asim-info-item { display: flex; flex-direction: column; }
  #axpo-sim-tpl .asim-info-label { font-size: 8pt; color: #999; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  #axpo-sim-tpl .asim-info-value { font-size: 10pt; color: #333; font-weight: 500; }
  #axpo-sim-tpl .asim-comparison { display: flex; gap: 20px; margin-bottom: 30px; }
  #axpo-sim-tpl .asim-plan-card { flex: 1; border: 2px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  #axpo-sim-tpl .asim-plan-card--axpo { border-color: #4CAF50; }
  #axpo-sim-tpl .asim-plan-header { padding: 15px; font-weight: bold; font-size: 11pt; }
  #axpo-sim-tpl .asim-plan-header--current { background-color: #f5f5f5; color: #333; }
  #axpo-sim-tpl .asim-plan-header--axpo { background-color: #4CAF50; color: white; }
  #axpo-sim-tpl .asim-plan-subheader { font-size: 8pt; font-weight: normal; opacity: 0.8; margin-top: 2px; }
  #axpo-sim-tpl .asim-plan-body { padding: 15px; }
  #axpo-sim-tpl .asim-data-section { margin-bottom: 20px; }
  #axpo-sim-tpl .asim-data-section-title { font-size: 9pt; font-weight: bold; color: #666; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; }
  #axpo-sim-tpl .asim-period-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
  #axpo-sim-tpl .asim-period-item { text-align: center; padding: 8px; background: #f9f9f9; border-radius: 4px; }
  #axpo-sim-tpl .asim-period-label { font-size: 8pt; color: #999; font-weight: bold; }
  #axpo-sim-tpl .asim-period-value { font-size: 10pt; color: #333; margin-top: 3px; }
  #axpo-sim-tpl .asim-cost-breakdown { margin-top: 15px; }
  #axpo-sim-tpl .asim-cost-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
  #axpo-sim-tpl .asim-cost-item:last-child { border-bottom: none; }
  #axpo-sim-tpl .asim-cost-label { font-size: 9pt; color: #666; }
  #axpo-sim-tpl .asim-cost-value { font-size: 9pt; color: #333; font-weight: 500; }
  #axpo-sim-tpl .asim-total-section { margin-top: 15px; padding-top: 15px; border-top: 2px solid #333; }
  #axpo-sim-tpl .asim-total-item { display: flex; justify-content: space-between; padding: 5px 0; font-weight: bold; }
  #axpo-sim-tpl .asim-total-label { font-size: 11pt; color: #333; }
  #axpo-sim-tpl .asim-total-value { font-size: 14pt; color: #333; }
  #axpo-sim-tpl .asim-total-value--savings { color: #4CAF50; }
  #axpo-sim-tpl .asim-savings-badge { display: inline-block; background: #4CAF50; color: white; padding: 8px 15px; border-radius: 20px; font-size: 10pt; font-weight: bold; margin-top: 10px; }
  #axpo-sim-tpl .asim-savings-center { text-align: center; }
  #axpo-sim-tpl .asim-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; font-size: 8pt; color: #999; line-height: 1.6; }
  #axpo-sim-tpl .asim-footer-title { font-weight: bold; margin-bottom: 5px; color: #666; }
  @media print {
    #axpo-sim-tpl .asim-period-grid,
    #axpo-sim-tpl .asim-period-item,
    #axpo-sim-tpl .asim-cost-breakdown,
    #axpo-sim-tpl .asim-cost-item,
    #axpo-sim-tpl .asim-total-section,
    #axpo-sim-tpl .asim-savings-badge,
    #axpo-sim-tpl .asim-basic-data,
    #axpo-sim-tpl .asim-header { break-inside: avoid; page-break-inside: avoid; }
    #axpo-sim-tpl .asim-section-title,
    #axpo-sim-tpl .asim-data-section-title,
    #axpo-sim-tpl .asim-plan-header { break-after: avoid; page-break-after: avoid; }
  }
</style>

<div id="axpo-sim-tpl">

  <div class="asim-header">
    <div><div class="asim-greeting">Hola,<br>{{CLIENT_NAME}}</div></div>
    <div>
      <svg width="80" height="40" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 10 L30 30 L40 10 L50 30 L60 10" stroke="#E91E63" stroke-width="3" fill="none"/>
        <circle cx="20" cy="10" r="3" fill="#E91E63"/>
        <circle cx="40" cy="10" r="3" fill="#9C27B0"/>
        <circle cx="60" cy="10" r="3" fill="#3F51B5"/>
        <circle cx="30" cy="30" r="3" fill="#FF9800"/>
        <circle cx="50" cy="30" r="3" fill="#4CAF50"/>
      </svg>
    </div>
  </div>

  <div class="asim-intro">
    Esta es tu simulacion.<br>
    Lorem Ipsum has been the industry standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries.
  </div>

  <div class="asim-basic-data">
    <div class="asim-section-title">Datos basicos de la simulacion</div>
    <div class="asim-info-grid">
      <div class="asim-info-item"><div class="asim-info-label">Cliente</div><div class="asim-info-value">{{CLIENT_NAME}}</div></div>
      <div class="asim-info-item"><div class="asim-info-label">Direccion</div><div class="asim-info-value">{{CLIENT_ADDRESS}}</div></div>
      <div class="asim-info-item"><div class="asim-info-label">Producto</div><div class="asim-info-value">{{PRODUCT_NAME}}</div></div>
      <div class="asim-info-item"><div class="asim-info-label">CUPS</div><div class="asim-info-value">{{CUPS_NUMBER}}</div></div>
      <div class="asim-info-item"><div class="asim-info-label">Periodo Simulacion</div><div class="asim-info-value">{{SIMULATION_PERIOD}}</div></div>
      <div class="asim-info-item"><div class="asim-info-label">Consumo Anual (kWh)</div><div class="asim-info-value">{{ANNUAL_CONSUMPTION}}</div></div>
    </div>
  </div>

  <div class="asim-comparison">

    <div class="asim-plan-card">
      <div class="asim-plan-header asim-plan-header--current">Plano Atual<div class="asim-plan-subheader">Tarifa CUPS</div></div>
      <div class="asim-plan-body">
        <div class="asim-data-section">
          <div class="asim-data-section-title">Potencia contratada (kW)</div>
          <div class="asim-period-grid">
            <div class="asim-period-item"><div class="asim-period-label">P1</div><div class="asim-period-value">{{CURRENT_POWER_P1}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P2</div><div class="asim-period-value">{{CURRENT_POWER_P2}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P3</div><div class="asim-period-value">{{CURRENT_POWER_P3}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P4</div><div class="asim-period-value">{{CURRENT_POWER_P4}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P5</div><div class="asim-period-value">{{CURRENT_POWER_P5}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P6</div><div class="asim-period-value">{{CURRENT_POWER_P6}}</div></div>
          </div>
        </div>
        <div class="asim-data-section">
          <div class="asim-data-section-title">Energia Mensual (kWh)</div>
          <div class="asim-period-grid">
            <div class="asim-period-item"><div class="asim-period-label">P1</div><div class="asim-period-value">{{CURRENT_ENERGY_P1}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P2</div><div class="asim-period-value">{{CURRENT_ENERGY_P2}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P3</div><div class="asim-period-value">{{CURRENT_ENERGY_P3}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P4</div><div class="asim-period-value">{{CURRENT_ENERGY_P4}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P5</div><div class="asim-period-value">{{CURRENT_ENERGY_P5}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P6</div><div class="asim-period-value">{{CURRENT_ENERGY_P6}}</div></div>
          </div>
        </div>
        <div class="asim-cost-breakdown">
          <div class="asim-cost-item"><div class="asim-cost-label">T. Potencia</div><div class="asim-cost-value">{{CURRENT_POWER_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">T. Energia</div><div class="asim-cost-value">{{CURRENT_ENERGY_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Excesos</div><div class="asim-cost-value">{{CURRENT_EXCESS_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Impuestos</div><div class="asim-cost-value">{{CURRENT_TAX_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Otros cargos</div><div class="asim-cost-value">{{CURRENT_OTHER_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Alquiler</div><div class="asim-cost-value">{{CURRENT_RENTAL_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">IVA</div><div class="asim-cost-value">{{CURRENT_VAT}} &euro;</div></div>
        </div>
        <div class="asim-total-section">
          <div class="asim-total-item"><div class="asim-total-label">Total</div><div class="asim-total-value">{{CURRENT_TOTAL}} &euro;</div></div>
        </div>
      </div>
    </div>

    <div class="asim-plan-card asim-plan-card--axpo">
      <div class="asim-plan-header asim-plan-header--axpo">Plano Axpo<div class="asim-plan-subheader">Tarifa personalizada Index</div></div>
      <div class="asim-plan-body">
        <div class="asim-data-section">
          <div class="asim-data-section-title">Potencia contratada (kW)</div>
          <div class="asim-period-grid">
            <div class="asim-period-item"><div class="asim-period-label">P1</div><div class="asim-period-value">{{AXPO_POWER_P1}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P2</div><div class="asim-period-value">{{AXPO_POWER_P2}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P3</div><div class="asim-period-value">{{AXPO_POWER_P3}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P4</div><div class="asim-period-value">{{AXPO_POWER_P4}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P5</div><div class="asim-period-value">{{AXPO_POWER_P5}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P6</div><div class="asim-period-value">{{AXPO_POWER_P6}}</div></div>
          </div>
        </div>
        <div class="asim-data-section">
          <div class="asim-data-section-title">Energia Mensual (kWh)</div>
          <div class="asim-period-grid">
            <div class="asim-period-item"><div class="asim-period-label">P1</div><div class="asim-period-value">{{AXPO_ENERGY_P1}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P2</div><div class="asim-period-value">{{AXPO_ENERGY_P2}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P3</div><div class="asim-period-value">{{AXPO_ENERGY_P3}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P4</div><div class="asim-period-value">{{AXPO_ENERGY_P4}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P5</div><div class="asim-period-value">{{AXPO_ENERGY_P5}}</div></div>
            <div class="asim-period-item"><div class="asim-period-label">P6</div><div class="asim-period-value">{{AXPO_ENERGY_P6}}</div></div>
          </div>
        </div>
        <div class="asim-cost-breakdown">
          <div class="asim-cost-item"><div class="asim-cost-label">T. Potencia</div><div class="asim-cost-value">{{AXPO_POWER_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">T. Energia</div><div class="asim-cost-value">{{AXPO_ENERGY_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Excesos</div><div class="asim-cost-value">{{AXPO_EXCESS_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Impuestos</div><div class="asim-cost-value">{{AXPO_TAX_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Otros cargos</div><div class="asim-cost-value">{{AXPO_OTHER_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">Alquiler</div><div class="asim-cost-value">{{AXPO_RENTAL_COST}} &euro;</div></div>
          <div class="asim-cost-item"><div class="asim-cost-label">IVA</div><div class="asim-cost-value">{{AXPO_VAT}} &euro;</div></div>
        </div>
        <div class="asim-total-section">
          <div class="asim-total-item"><div class="asim-total-label">Total</div><div class="asim-total-value asim-total-value--savings">{{AXPO_TOTAL}} &euro;</div></div>
          <div class="asim-savings-center"><div class="asim-savings-badge">Ahorro de {{SAVINGS_AMOUNT}} &euro;</div></div>
        </div>
      </div>
    </div>

  </div>

  <div class="asim-footer">
    <div class="asim-footer-title">Simulacion presentada por FIVA ENERGIA</div>
    <p>Los calculos de propuesta en perfil de consumo en horas de semana. Los precios reflejados en todo caso no recogen actualizaciones por cambios en condiciones de mercado, actualizacion de subasores, aplicacion de bono social, regulado y operador mercado, y PYMES, asi como cambios sobrevenidos. Las condiciones de contrato son las definidas en el contrato realizado y operador mercado.</p>
  </div>

</div>`,
    },
  });

  await prisma.pdfTemplate.upsert({
    where: { id: "price-history-default" },
    update: {},
    create: {
      id: "price-history-default",
      name: "Price History - Default",
      description: "Price history report template with indexed prices for last 12 months",
      type: "price-history",
      commodity: "ELECTRICITY",
      active: true,
      htmlContent: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* ── Reset ─────────────────────────────────────────────────────────────── */
    .ph-root, .ph-root * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page ──────────────────────────────────────────────────────────────── */
    .ph-root {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #2d2d2d;
      background: #ffffff;
      padding: 36px 44px;
    }

    /* ── Header ────────────────────────────────────────────────────────────── */
    .doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 18px;
      border-bottom: 3px solid #e8645a;
      margin-bottom: 28px;
    }
    .doc-logo {
      font-size: 26px;
      font-weight: 900;
      color: #e8645a;
      letter-spacing: -0.5px;
    }
    .doc-meta {
      text-align: right;
      font-size: 11px;
      color: #888;
      line-height: 1.6;
    }
    .doc-meta strong {
      color: #444;
    }

    /* ── Page title ────────────────────────────────────────────────────────── */
    .doc-title {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      color: #2d2d2d;
      margin-bottom: 6px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 11px;
      color: #888;
      margin-bottom: 32px;
    }

    /* ── Client strip ──────────────────────────────────────────────────────── */
    .client-strip {
      display: flex;
      gap: 0;
      margin-bottom: 28px;
      border: 1px solid #e8e8e8;
      border-radius: 6px;
      overflow: hidden;
    }
    .client-field {
      flex: 1;
      padding: 10px 14px;
      border-right: 1px solid #e8e8e8;
    }
    .client-field:last-child { border-right: none; }
    .client-field-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #aaa;
      margin-bottom: 3px;
    }
    .client-field-value {
      font-size: 12px;
      font-weight: 600;
      color: #2d2d2d;
    }

    /* ── Tables injected via {{HISTORY_TABLES}} ────────────────────────────── */
    /* Inner tables are fully inline-styled by the generator; no extra CSS needed. */

    /* ── Footer ────────────────────────────────────────────────────────────── */
    .doc-footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid #e8e8e8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #aaa;
    }
    .doc-footer-brand {
      font-weight: 700;
      color: #e8645a;
    }
  </style>
</head>
<body>
<div class="ph-root">

  <!-- ── Document header ────────────────────────────────────────────────── -->
  <div class="doc-header">
    <div class="doc-logo">AXPO</div>
    <div class="doc-meta">
      <div><strong>Simulación:</strong> {{SIMULATION_ID}}</div>
      <div><strong>Fecha:</strong> {{CREATED_AT}}</div>
      <div><strong>Comercial:</strong> {{OWNER_NAME}}</div>
    </div>
  </div>

  <!-- ── Page title ─────────────────────────────────────────────────────── -->
  <div class="doc-title">
    Histórico indexado últimos 12 meses — {{PRODUCT_LABEL}} — {{PERFIL}}
  </div>
  <div class="doc-subtitle">
    Márgenes €/kWh por período tarifario
  </div>

  <!-- ── Client info strip ──────────────────────────────────────────────── -->
  <div class="client-strip">
    <div class="client-field">
      <div class="client-field-label">Cliente</div>
      <div class="client-field-value">{{CLIENT_NAME}}</div>
    </div>
    <div class="client-field">
      <div class="client-field-label">Producto</div>
      <div class="client-field-value">{{PRODUCT_LABEL}}</div>
    </div>
    <div class="client-field">
      <div class="client-field-label">Tarifa acceso</div>
      <div class="client-field-value">{{TARIFA}}</div>
    </div>
    <div class="client-field">
      <div class="client-field-label">Perfil de carga</div>
      <div class="client-field-value">{{PERFIL}}</div>
    </div>
  </div>

  <!-- ── History tables (all tariffs) ──────────────────────────────────── -->
  <div class="history-body">
    {{HISTORY_TABLES}}
  </div>

  <!-- ── Footer ─────────────────────────────────────────────────────────── -->
  <div class="doc-footer">
    <span><span class="doc-footer-brand">AXPO</span> — Documento generado automáticamente</span>
    <span>{{OWNER_NAME}} · {{OWNER_EMAIL}}</span>
  </div>
  </div><!-- /.ph-root -->
</body>
</html>`,
    },
  });

  console.log("Seed completed: agency + users + clients + email templates + PDF templates created");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });