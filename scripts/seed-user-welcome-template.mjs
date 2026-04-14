import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedUserWelcomeTemplate() {
  console.log("Seeding user welcome email template...");

  const template = await prisma.emailTemplate.upsert({
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

  console.log(`✅ Created/updated template: ${template.name} (${template.id})`);
}

async function main() {
  try {
    await seedUserWelcomeTemplate();
    console.log("✅ User welcome email template seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding user welcome email template:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
