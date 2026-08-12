ALTER TABLE "system_config"
ADD COLUMN "accessRequestKamEmailTemplateId" TEXT,
ADD COLUMN "accessRequestApplicantEmailTemplateId" TEXT;

ALTER TABLE "access_requests"
ADD COLUMN "languageCode" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "applicantNotificationSentAt" TIMESTAMP(3),
ADD COLUMN "applicantNotificationError" TEXT;

INSERT INTO "email_templates" (
  "id", "name", "description", "type", "active", "subject", "htmlContent", "createdAt", "updatedAt"
) VALUES
(
  'default_access_request_kam',
  'Access Request · KAM Notification',
  'Notifies the selected KAM when a new access request is received.',
  'access-request-kam',
  true,
  'New access request · {{AGENCY_NAME}}',
  '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>New access request</h2><p>Hello {{KAM_NAME}},</p><p>A new access request is waiting for review.</p><table style="border-collapse:collapse;width:100%;background:#f7f7f7"><tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">{{APPLICANT_NAME}}</td></tr><tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">{{APPLICANT_EMAIL}}</td></tr><tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">{{APPLICANT_PHONE}}</td></tr><tr><td style="padding:8px;font-weight:bold">Agency</td><td style="padding:8px">{{AGENCY_NAME}}</td></tr></table><p style="color:#666;font-size:12px">Reference: {{REQUEST_ID}}</p></div>',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'default_access_request_applicant',
  'Access Request · Applicant Confirmation',
  'Confirms to the applicant that their access request is pending review.',
  'access-request-applicant',
  true,
  'We received your access request',
  '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Request received</h2><p>Hello {{APPLICANT_NAME}},</p><p>We received your request to access the AXPO Offers Simulator. It is now pending review by {{KAM_NAME}}.</p><p><strong>Agency:</strong> {{AGENCY_NAME}}</p><p>We will contact you when your request has been reviewed.</p><p style="color:#666;font-size:12px">Reference: {{REQUEST_ID}}</p></div>',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "email_template_translations" (
  "id", "emailTemplateId", "languageCode", "subject", "htmlContent", "createdAt", "updatedAt"
) VALUES
('access_request_kam_en', 'default_access_request_kam', 'en', 'New access request · {{AGENCY_NAME}}', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>New access request</h2><p>Hello {{KAM_NAME}},</p><p>A new access request is waiting for review.</p><p><strong>Name:</strong> {{APPLICANT_NAME}}<br><strong>Email:</strong> {{APPLICANT_EMAIL}}<br><strong>Phone:</strong> {{APPLICANT_PHONE}}<br><strong>Agency:</strong> {{AGENCY_NAME}}</p><p style="color:#666;font-size:12px">Reference: {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_kam_es', 'default_access_request_kam', 'es', 'Nueva solicitud de alta · {{AGENCY_NAME}}', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Nueva solicitud de alta</h2><p>Hola {{KAM_NAME}},</p><p>Hay una nueva solicitud de alta pendiente de revisión.</p><p><strong>Nombre:</strong> {{APPLICANT_NAME}}<br><strong>Email:</strong> {{APPLICANT_EMAIL}}<br><strong>Teléfono:</strong> {{APPLICANT_PHONE}}<br><strong>Agencia:</strong> {{AGENCY_NAME}}</p><p style="color:#666;font-size:12px">Referencia: {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_kam_fr', 'default_access_request_kam', 'fr', 'Nouvelle demande d’accès · {{AGENCY_NAME}}', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Nouvelle demande d’accès</h2><p>Bonjour {{KAM_NAME}},</p><p>Une nouvelle demande d’accès est en attente d’examen.</p><p><strong>Nom :</strong> {{APPLICANT_NAME}}<br><strong>E-mail :</strong> {{APPLICANT_EMAIL}}<br><strong>Téléphone :</strong> {{APPLICANT_PHONE}}<br><strong>Agence :</strong> {{AGENCY_NAME}}</p><p style="color:#666;font-size:12px">Référence : {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_kam_pt', 'default_access_request_kam', 'pt', 'Novo pedido de acesso · {{AGENCY_NAME}}', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Novo pedido de acesso</h2><p>Olá {{KAM_NAME}},</p><p>Existe um novo pedido de acesso pendente de análise.</p><p><strong>Nome:</strong> {{APPLICANT_NAME}}<br><strong>E-mail:</strong> {{APPLICANT_EMAIL}}<br><strong>Telefone:</strong> {{APPLICANT_PHONE}}<br><strong>Agência:</strong> {{AGENCY_NAME}}</p><p style="color:#666;font-size:12px">Referência: {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_en', 'default_access_request_applicant', 'en', 'We received your access request', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Request received</h2><p>Hello {{APPLICANT_NAME}},</p><p>We received your request to access the AXPO Offers Simulator. It is pending review by {{KAM_NAME}}.</p><p><strong>Agency:</strong> {{AGENCY_NAME}}</p><p>We will contact you when it has been reviewed.</p><p style="color:#666;font-size:12px">Reference: {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_es', 'default_access_request_applicant', 'es', 'Hemos recibido tu solicitud de alta', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Solicitud recibida</h2><p>Hola {{APPLICANT_NAME}},</p><p>Hemos recibido tu solicitud de acceso al Simulador de Ofertas de AXPO. Está pendiente de revisión por {{KAM_NAME}}.</p><p><strong>Agencia:</strong> {{AGENCY_NAME}}</p><p>Contactaremos contigo cuando haya sido revisada.</p><p style="color:#666;font-size:12px">Referencia: {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_fr', 'default_access_request_applicant', 'fr', 'Nous avons reçu votre demande d’accès', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Demande reçue</h2><p>Bonjour {{APPLICANT_NAME}},</p><p>Nous avons reçu votre demande d’accès au simulateur d’offres AXPO. Elle est en attente d’examen par {{KAM_NAME}}.</p><p><strong>Agence :</strong> {{AGENCY_NAME}}</p><p>Nous vous contacterons après son examen.</p><p style="color:#666;font-size:12px">Référence : {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_pt', 'default_access_request_applicant', 'pt', 'Recebemos o seu pedido de acesso', '<div style="font-family:Arial,sans-serif;color:#282828;line-height:1.5;max-width:640px"><h2>Pedido recebido</h2><p>Olá {{APPLICANT_NAME}},</p><p>Recebemos o seu pedido de acesso ao Simulador de Ofertas AXPO. Está pendente de análise por {{KAM_NAME}}.</p><p><strong>Agência:</strong> {{AGENCY_NAME}}</p><p>Entraremos em contacto após a análise.</p><p style="color:#666;font-size:12px">Referência: {{REQUEST_ID}}</p></div>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("emailTemplateId", "languageCode") DO NOTHING;

INSERT INTO "template_variables" ("id", "key", "label", "description", "category", "example", "sortOrder", "active", "templateTypes", "createdAt", "updatedAt") VALUES
('access_request_id', 'REQUEST_ID', 'Request reference', 'Unique access request reference', 'access-request', 'cm123request', 300, true, 'access-request-kam,access-request-applicant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_name', 'APPLICANT_NAME', 'Applicant name', 'Name supplied by the access applicant', 'access-request', 'María García', 301, true, 'access-request-kam,access-request-applicant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_email', 'APPLICANT_EMAIL', 'Applicant email', 'Business email supplied by the applicant', 'access-request', 'maria@example.com', 302, true, 'access-request-kam,access-request-applicant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_applicant_phone', 'APPLICANT_PHONE', 'Applicant phone', 'Phone number supplied by the applicant', 'access-request', '+34 612 345 678', 303, true, 'access-request-kam,access-request-applicant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_agency_name', 'AGENCY_NAME', 'Agency name', 'Agency selected in the request', 'access-request', 'AXPO Madrid', 304, true, 'access-request-kam,access-request-applicant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('access_request_kam_name', 'KAM_NAME', 'KAM name', 'Selected AXPO account manager name', 'access-request', 'Alex García', 305, true, 'access-request-kam,access-request-applicant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "templateTypes" = EXCLUDED."templateTypes", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "system_config"
SET
  "accessRequestKamEmailTemplateId" = COALESCE("accessRequestKamEmailTemplateId", 'default_access_request_kam'),
  "accessRequestApplicantEmailTemplateId" = COALESCE("accessRequestApplicantEmailTemplateId", 'default_access_request_applicant');
