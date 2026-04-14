# Configurations Module

The Configurations module provides a centralized interface for managing system-wide settings, PDF templates, and email templates in the AXPO Simulator application.

## Overview

The Configurations menu is located at the bottom of the sidebar, just above the user profile card. It's accessible to administrators and provides three main sections:

### 1. System Settings

Configurable definitions for the application's core behavior:

#### Simulation Settings

- **Simulation Expiration Days** (default: 30) - Days before a simulation expires
- **Default Share Text Template** - Text template for sharing simulations with clients
- **Enable Pixel Tracking** - Track when clients view their simulations

#### User & Authentication

- **Require PIN for Simulation Access** - Enforce PIN validation for client access
- **PIN Length** (default: 4) - Number of digits in generated PINs

#### Client Management

- **Auto-create Client on New Simulation** - Automatically create client records when creating simulations without selecting an existing client

#### Module Visibility

- **Enable Analytics Module** - Show/hide the Analytics section
- **Enable Audit Logs Module** - Show/hide the Audit Logs section

#### Dashboard & Reports

- **Default Dashboard View** - Default view type (admin/master/commercial)
- **Enable Real-time Report Refresh** - Auto-refresh reports as filters change

### 2. PDF Templates

Visual editor for managing PDF templates used throughout the application:

#### Available Templates

- **Default Simulation PDF** - Standard simulation output with pricing details
- **Detailed Simulation PDF** - Comprehensive simulation with charts and historical data
- **Contract Template** - Official contract document for client signature

#### Features

- HTML-based template editor with syntax highlighting
- Live preview with sample data
- Template variable system (e.g., `{{simulationCode}}`, `{{clientName}}`)
- Active/Inactive status toggle
- Template versioning support

#### Available Variables

- `{{simulationCode}}` - Unique simulation identifier
- `{{clientName}}` - Company name
- `{{contactPerson}}` - Contact person name
- `{{productName}}` - Selected product name
- `{{totalCost}}` - Calculated total cost

### 3. Email Templates

Builder for managing email templates for notifications and communications:

#### Available Templates

- **Simulation Share Email** - Sent when sharing a simulation with clients
- **Magic Link Login** - Passwordless login link email
- **Welcome New User** - Welcome email for new user accounts
- **Simulation Expiring Soon** - Notification for expiring simulations

#### Features

- Subject and body editing
- Live preview with sample data
- Template variable system
- Active/Inactive status toggle
- Send test email functionality

#### Available Variables

- `{{simulationCode}}` - Simulation identifier
- `{{simulationLink}}` - Public simulation URL
- `{{pin}}` - Access PIN
- `{{commercialName}}` - Sales representative name
- `{{commercialEmail}}` - Sales representative email
- `{{commercialPhone}}` - Sales representative phone
- `{{expirationDays}}` - Days until expiration
- `{{userName}}` - User full name
- `{{userEmail}}` - User email address
- `{{userRole}}` - User role
- `{{agencyName}}` - Agency name
- `{{clientName}}` - Client company name
- `{{contactPerson}}` - Client contact person

## Technical Implementation

### Components

- **ConfigurationsModule** - Main tabbed interface
- **SystemSettings** - System-wide configuration panel
- **PdfTemplates** - PDF template builder and editor
- **EmailTemplates** - Email template builder and editor

### File Structure

```
app/internal/
  configurations/
    page.tsx                     # Main configurations page
    system-settings/
      page.tsx                   # System settings sub-route
    pdf-templates/
      page.tsx                   # PDF templates sub-route
    email-templates/
      page.tsx                   # Email templates sub-route

app/internal/components/
  modules/
    ConfigurationsModule.tsx     # Main module component
    SystemSettings.tsx           # System settings panel
    PdfTemplates.tsx            # PDF templates builder
    EmailTemplates.tsx          # Email templates builder
    configurations.css          # Shared styles
```

### Routing

The configurations section is integrated into the main application routing:

- `/internal/configurations` - Main configurations page
- `/internal/configurations/system-settings` - System settings (handled by tabs)
- `/internal/configurations/pdf-templates` - PDF templates (handled by tabs)
- `/internal/configurations/email-templates` - Email templates (handled by tabs)

### Access Control

Currently, the Configurations menu is visible to all authenticated users. Consider restricting access to ADMIN role only by updating the `InternalWorkspace.tsx` component:

```typescript
canSeeConfigurationsSection={isAdmin(role)}
```

## Future Enhancements

### API Integration

- Connect to backend API for persisting configuration changes
- Add configuration history and audit trail
- Implement configuration versioning

### Advanced Features

- Rich text editor for email templates (WYSIWYG)
- PDF template preview with real simulation data
- Export/import configuration sets
- Multi-language support for templates
- Template validation and testing tools

### Additional Configuration Areas

- **Module Definitions** - Configure module-specific settings
- **Workflow Automation** - Define automatic actions and triggers
- **Integration Settings** - Configure external system connections
- **Notification Rules** - Define when and how to send notifications

## Configuration from Specification

Based on the AXPO specification document, the following definitions are now configurable:

### Login Settings

- Magic link expiration time (currently hardcoded to 15 minutes)
- Initial access credentials generation

### Dashboard Settings

- Default views per role (Admin, Master, Commercial)
- Statistics shortcuts configuration
- Recent records history length

### User Settings

- PIN requirements and format
- Editable fields per profile type
- User deactivation rules

### Client Settings

- Auto-creation on simulation
- TAG management system
- Client status definitions
- Filter configurations

### Simulation Settings

- Expiration days (default: 30)
- Share text templates
- Pixel tracking
- Archived vs deleted rules
- Conversion marking
- Price table versioning

### Reports Settings

- Real-time refresh behavior
- Filter persistence
- Data scope configurations

## Notes

- All configuration changes are currently stored in component state
- TODO: Implement backend API endpoints for persistence
- TODO: Add validation for configuration values
- TODO: Implement role-based access control for configurations
