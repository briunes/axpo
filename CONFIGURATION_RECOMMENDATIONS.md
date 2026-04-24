# System Configuration Recommendations

**Document created:** 17 de abril de 2026

This document outlines recommended system configurations for the AXPO Energy Simulator, categorized by priority and implementation status.

---

## **Currently Implemented** ✅

### 1. System Settings (In Place)

- Simulation expiration (30 days default)
- Auto-create client on simulation
- SMTP configuration (host, port, security, credentials, from email/name)
- Email templates for automated workflows
- Pixel tracking toggle
- PIN requirements

### 2. PDF & Email Templates

- Customizable templates with variable substitution
- Multiple template types (user-welcome, simulation-output, etc.)

### 3. Role Permissions

- Granular permission management per role

### 4. Base Values Management (Implemented ✅)

- **Calculation formula parameters** (IVA rate, electricity tax) ✅ DONE
- **Base values version control** (production vs testing flag) ✅ DONE
- **Tariff availability toggles** (enable/disable specific tariffs per agency) ✅ DONE

### 5. User Preferences System (In Progress 🔄)

- **System-level default preferences** (date format, time format, number format, timezone)
- **User-level preference overrides** (profile and user edit tabs)
- **Automatic inheritance** from system defaults

---

## **Essential Missing Configurations** 🔴

### 6. Base Values Management (Remaining)

- **Default markup/margin percentages** per product type
- **Default agency-level margins** (override global)

### 5. Simulation Behavior

- **Validation rules** (min/max consumption, power limits)
- **Default values** for simulation fields
- **CUPS lookup behavior** (auto-suggest from history)
- **OCR settings** for invoice parsing (when implemented)
- **Conversion tracking rules** (auto-mark as converted after X days)

### 6. Security & Access

- **Password policy** (min length, complexity, expiration days)
- **Setup token expiration** (currently hardcoded to 72h)
- **Session timeout duration**
- **Failed login attempt limits**
- **Two-factor authentication toggle**
- **IP whitelist/blacklist**

### 7. Data Retention

- **Audit log retention period**
- **Email log retention period**
- **Soft-deleted record purge schedule**
- **Simulation archive rules**

---

## **Quality of Life Configurations** 🟡

### 8. Display & UI

- **Default language** per agency/user
- **Date/time format preferences**
- **Number format** (decimal separators)
- **Currency display**
- **Items per page** in data tables
- **Default dashboard view** per role

### 9. Notifications

- **Email notification toggles** (simulation shared, user created, etc.)
- **In-app notification preferences**
- **Notification frequency** (instant, daily digest, weekly)
- **Notification templates** per event type

### 10. Agency-Specific Overrides

- **Custom branding** (logo, colors for PDFs/emails)
- **Custom email signatures**
- **Agency-specific disclaimers/legal text**
- **Custom PDF footer text**
- **Agency contact information** (phone, email, website)

### 11. Commercial Features

- **Commission calculation rules**
- **Pricing tier definitions** (volume discounts)
- **Client tags/categories** configuration
- **Lead scoring rules**
- **Follow-up reminder intervals**

### 12. Analytics & Reporting

- **Default report date ranges**
- **Report refresh intervals** for real-time mode
- **Export formats** available
- **Data aggregation rules**
- **KPI targets** (monthly simulations, conversion rates)

### 13. Integration Settings

- **API rate limits**
- **Webhook URLs** for external systems
- **External CRM integration** toggles
- **Third-party service API keys** (OCR, analytics, etc.)

### 14. Maintenance Mode

- **Enable/disable public access**
- **Maintenance message** (customizable)
- **Whitelisted IPs** during maintenance

### 15. Feature Flags

- **Enable/disable modules** (Analytics, Audit Logs, etc.) - partially done
- **Beta feature toggles**
- **A/B testing configurations**

---

## **Suggested Priority Order**

### Phase 1 (Critical)

1. **Base values management** (margins, tariff availability)
   - Agency-level margin overrides
   - Tariff enable/disable per agency
   - Calculation constants (IVA, electricity tax)

2. **Security settings** (password policy, session timeout)
   - Password complexity requirements
   - Session/token expiration settings
   - Login attempt limits

3. **Validation rules for simulations**
   - Min/max consumption limits
   - Power range validation
   - Field-level validation rules

### Phase 2 (High Value)

1. **Agency-specific overrides** (branding, contact info)
   - Logo upload
   - Color scheme customization
   - Contact information per agency

2. **Data retention policies**
   - Automatic cleanup schedules
   - Archive vs. purge rules
   - Compliance-related retention

3. **Notification preferences**
   - Per-event toggles
   - Frequency settings
   - Template management

### Phase 3 (Nice to Have)

1. **Commercial features** (commissions, pricing tiers)
   - Commission calculation engine
   - Volume-based pricing
   - Client segmentation

2. **Advanced analytics configuration**
   - Custom KPI definitions
   - Dashboard customization
   - Report scheduling

3. **Feature flags system**
   - Gradual rollout capability
   - A/B testing framework
   - Beta feature access

---

## Implementation Notes

### Database Schema Considerations

For most configurations, consider adding to the existing `SystemConfig` table:

```prisma
model SystemConfig {
  // ... existing fields ...

  // Phase 1 additions
  defaultMarginPercentage     Decimal?
  ivaRate                     Decimal   @default(0.21)
  electricityTaxRate          Decimal   @default(0.051127)
  passwordMinLength           Int       @default(12)
  passwordRequireUppercase    Boolean   @default(true)
  passwordRequireLowercase    Boolean   @default(true)
  passwordRequireNumbers      Boolean   @default(true)
  passwordRequireSpecialChars Boolean   @default(true)
  sessionTimeoutMinutes       Int       @default(480)
  setupTokenExpirationHours   Int       @default(72)
  maxLoginAttempts            Int       @default(5)

  // Phase 2 additions
  auditLogRetentionDays       Int       @default(365)
  emailLogRetentionDays       Int       @default(90)
  deletedRecordPurgeDays      Int       @default(30)

  // ... etc
}
```

For agency-specific configurations, consider a separate table:

```prisma
model AgencyConfig {
  id                String   @id @default(cuid())
  agencyId          String   @unique
  agency            Agency   @relation(fields: [agencyId], references: [id])

  logoUrl           String?
  primaryColor      String?  @default("#dc2626")
  secondaryColor    String?
  contactEmail      String?
  contactPhone      String?
  websiteUrl        String?
  customDisclaimer  String?  @db.Text
  emailSignature    String?  @db.Text

  marginOverride    Decimal? // Override global margin

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("agency_configs")
}
```

### UI Considerations

- Add subtabs under System Settings for: Security, Validation, Retention, etc.
- Create separate "Agency Configuration" module for agency-specific settings
- Use collapsible sections for related settings groups
- Provide inline help text/tooltips for each setting
- Show "Reset to Default" option for each configurable value

### Migration Strategy

1. Add configuration fields with sensible defaults
2. Ensure backward compatibility (existing code works with defaults)
3. Gradually expose UI controls for each setting
4. Document configuration options in admin guide
5. Provide bulk import/export for configuration backup

---

## Related Files

- Current implementation: `prisma/schema.prisma` (SystemConfig model)
- Settings UI: `app/internal/components/modules/SystemSettingsNew.tsx`
- API endpoints: `app/api/v1/internal/config/`
- Documentation: `EMAIL_SYSTEM_GUIDE.md`, `CALCULATION_IMPLEMENTATION.md`
