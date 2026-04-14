import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding configuration data...");

    // Create default system config
    const systemConfig = await prisma.systemConfig.upsert({
        where: { id: "default" },
        update: {},
        create: {
            id: "default",
            simulationExpirationDays: 30,
            simulationShareText: "Your simulation is ready. Access it with PIN: {PIN}",
            enablePixelTracking: true,
            requirePinForAccess: true,
            pinLength: 4,
            autoCreateClientOnSim: false,
            enableAnalyticsModule: true,
            enableAuditLogsModule: true,
            defaultDashboardView: "COMMERCIAL",
            enableRealtimeReports: false,
        },
    });
    console.log("✓ System config created");

    // Create default PDF templates
    const pdfTemplates = [
        {
            name: "Standard Simulation PDF",
            description: "Default simulation output with pricing details",
            type: "simulation-output",
            active: true,
            htmlContent: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .container { padding: 40px; }
        .header { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #dc2626; }
        h2 { color: #374151; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">AXPO</div>
            <p>Energy Simulation Report</p>
        </div>
        <h2>Client Information</h2>
        <p><strong>Company:</strong> {{clientName}}</p>
        <p><strong>Contact:</strong> {{contactPerson}}</p>
        <p><strong>Simulation Code:</strong> {{simulationCode}}</p>
        <h2>Results</h2>
        <table>
            <tr><th>Product</th><td>{{productName}}</td></tr>
            <tr><th>Total Cost</th><td>{{totalCost}}</td></tr>
        </table>
    </div>
</body>
</html>`,
        },
    ];

    for (const template of pdfTemplates) {
        await prisma.pdfTemplate.create({ data: template });
    }
    console.log(`✓ Created ${pdfTemplates.length} PDF template(s)`);

    // Create default email templates
    const emailTemplates = [
        {
            name: "Simulation Share Email",
            description: "Email sent when sharing a simulation with clients",
            type: "simulation-share",
            active: true,
            subject: "Your AXPO Energy Simulation - {{simulationCode}}",
            htmlContent: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #374151; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AXPO Energy Solutions</h1>
        </div>
        <div class="content">
            <p>Dear {{contactPerson}},</p>
            <p>Thank you for your interest in AXPO energy solutions.</p>
            <p>We have prepared a personalized energy simulation for <strong>{{clientName}}</strong>. You can view the detailed results by clicking the link below:</p>
            <p style="text-align: center;">
                <a href="{{simulationLink}}" class="button">View Simulation</a>
            </p>
            <p>Your access PIN is: <strong>{{pin}}</strong></p>
            <p>This simulation will be available for {{expirationDays}} days.</p>
            <p>Best regards,<br>{{commercialName}}<br>{{commercialEmail}}<br>{{commercialPhone}}</p>
        </div>
        <div class="footer">
            © 2026 AXPO Energy Solutions. All rights reserved.
        </div>
    </div>
</body>
</html>`,
        },
    ];

    for (const template of emailTemplates) {
        await prisma.emailTemplate.create({ data: template });
    }
    console.log(`✓ Created ${emailTemplates.length} email template(s)`);

    console.log("✓ Configuration seeding complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
