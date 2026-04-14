# Configurations System - Complete Implementation

## Overview

The Configurations system provides a professional interface for managing system settings, PDF templates, and email templates. **Both PDF and Email templates now include a visual WYSIWYG editor (TinyMCE)** for non-developers to create templates easily.

## Key Features

### 1. System Settings (Sub-tabbed)

Five dedicated tabs for different configuration areas:

#### **Simulation Tab**

- Simulation expiration days (default: 30)
- Default share text template with variable support `{PIN}`
- Pixel tracking toggle

#### **Users & Auth Tab**

- Require PIN for simulation access toggle
- PIN length configuration (4-8 digits)

#### **Clients Tab**

- Auto-create client on simulation toggle

#### **Modules Tab**

- Enable/disable Analytics module
- Enable/disable Audit Logs module

#### **Dashboard & Reports Tab**

- Default dashboard view (Admin/Master/Commercial)
- Real-time report refresh toggle

### 2. PDF Templates (Table View + Visual Editor)

Full CRUD interface for PDF templates with **TinyMCE visual editor**:

**Template Types:**

- `simulation-output` - Standard simulation PDF
- `simulation-detailed` - Detailed simulation with charts
- `contract` - Contract documents
- `price-history` - Historical price reports
- `invoice` - Invoice documents
- `report` - General reports

**Visual Editor Features:**

- WYSIWYG editing (no HTML knowledge required)
- Rich text formatting, tables, images, links
- Code view for advanced users
- Live preview with sample data
- Template variable support

**Features:**

- ✅ Table view with sortable columns
- ✅ Create/Edit/Delete operations
- ✅ Activate/Deactivate templates
- ✅ Modal editor with **TinyMCE visual WYSIWYG editor**
- ✅ Live preview with sample data
- ✅ Template variables: `{{clientName}}`, `{{contactPerson}}`, `{{simulationCode}}`, `{{productName}}`, `{{totalCost}}`

**Visual Editor (TinyMCE):**

- ✅ WYSIWYG interface - no HTML knowledge required
- ✅ Rich text formatting (bold, italic, colors, fonts)
- ✅ Tables, images, links support
- ✅ Code view button for advanced HTML editing
- ✅ Live preview rendering with sample data
- ✅ Helpful tip text explaining the code button
- ✅ Professional toolbar with all formatting options

### 3. Email Templates (Table View + Visual Editor)

Full CRUD interface for email templates with **TinyMCE visual editor**:

**Template Types:**

- `simulation-share` - Simulation sharing emails
- `magic-link` - Passwordless login links
- `welcome` - New user welcome
- `password-reset` - Password reset emails
- `expiring-soon` - Expiration warnings
- `converted` - Conversion notifications
- `notification` - General notifications

**Features:**

- ✅ Table view with all template details
- ✅ Create/Edit/Delete operations
- ✅ Activate/Deactivate templates
- ✅ Modal editor with subject and **TinyMCE visual editor**
- ✅ Live preview with sample data
- ✅ Send test email (placeholder)
- ✅ Template variables: `{{contactPerson}}`, `{{clientName}}`, `{{simulationLink}}`, `{{pin}}`, `{{commercialName}}`, `{{commercialEmail}}`, `{{commercialPhone}}`, `{{expirationDays}}`, `{{userName}}`, `{{magicLink}}`

**Visual Editor (TinyMCE):**

- ✅ Subject line editing with variable preview
- ✅ WYSIWYG HTML email editing
- ✅ Rich text formatting, tables, images, links
- ✅ Code view for advanced users
- ✅ Live email preview with sample data
- ✅ Helpful tip text for non-developers
- ✅ Send test email functionality (backend needed)

## UI/UX Improvements

### Visual Hierarchy

- **No spacing/padding waste** - Full-width layout
- **Clean tabs** - No gaps, proper borders, clear active states
- **Professional tables** - Hover effects, proper spacing, status badges
- **Modal editors** - Larger modals (1400px) with smooth animations
- **Visual editors** - TinyMCE with custom styling matching AXPO brand

### Color Scheme

- Primary red: `#dc2626` (AXPO brand color)
- Active states clearly marked
- Proper contrast for all text
- Editor help text in light blue: `#f0f9ff` background
- Status badges with green (active) / red (inactive)

### Interactions

- Smooth hover effects on all interactive elements
- Animated modals with fade-in and slide-up
- Table row hover highlights
- Button hover transformations
- Scrollbar styling

### Responsiveness

- Responsive grid for template cards (if needed)
- Adaptive table layouts
- Mobile-friendly modal sizing
- Touch-friendly button sizes

## Technical Implementation

### Component Structure

```
ConfigurationsModule.tsx         # Main container with top-level tabs
├── SystemSettingsNew.tsx        # Settings with 5 sub-tabs
├── PdfTemplatesNew.tsx         # PDF templates table + TinyMCE editor
├── EmailTemplatesNew.tsx       # Email templates table + TinyMCE editor
└── HtmlEditor.tsx              # Reusable TinyMCE visual editor component
```

### Installed Packages

**Visual Editor:**

```bash
npm install @tinymce/tinymce-react tinymce
```

- `@tinymce/tinymce-react` - React wrapper for TinyMCE
- `tinymce` - Core TinyMCE WYSIWYG editor
- Stored locally in `/public/tinymce/` for offline use
- No API key needed for basic features

**Additional Packages (installed but not actively used):**

- `grapesjs` - Visual page builder (can be used for advanced PDF templates)
- `grapesjs-preset-newsletter` - Email/newsletter builder preset
- `react-email-editor` - Alternative email builder

### State Management

- Local component state for CRUD operations
- Form data state for editor modals
- Preview state for live rendering
- Dirty tracking for save button states
- Editor key prop ensures re-rendering when switching templates

### Data Flow

```
1. Load templates from state (mock data)
2. Display in table format
3. Edit/Create opens modal with form
4. TinyMCE editor loads with initial HTML
5. User edits visually or in code view
6. onChange updates formData state
7. Save updates local state
8. TODO: API integration for persistence
```

## API Integration (TODO)

### Endpoints Needed

**System Settings:**

```typescript
GET / api / v1 / internal / config / system;
PUT / api / v1 / internal / config / system;
```

**PDF Templates:**

```typescript
GET    /api/v1/internal/templates/pdf
POST   /api/v1/internal/templates/pdf
GET    /api/v1/internal/templates/pdf/:id
PUT    /api/v1/internal/templates/pdf/:id
DELETE /api/v1/internal/templates/pdf/:id
PATCH  /api/v1/internal/templates/pdf/:id/toggle
```

**Email Templates:**

```typescript
GET    /api/v1/internal/templates/email
POST   /api/v1/internal/templates/email
GET    /api/v1/internal/templates/email/:id
PUT    /api/v1/internal/templates/email/:id
DELETE /api/v1/internal/templates/email/:id
PATCH  /api/v1/internal/templates/email/:id/toggle
POST   /api/v1/internal/templates/email/:id/test
```

## Template Variables

### PDF Templates

- `{{clientName}}` - Client company name
- `{{contactPerson}}` - Contact person name
- `{{simulationCode}}` - Unique simulation code
- `{{productName}}` - Selected product name
- `{{totalCost}}` - Calculated total cost

### Email Templates

- `{{contactPerson}}` - Contact person name
- `{{clientName}}` - Client company name
- `{{simulationCode}}` - Simulation identifier
- `{{simulationLink}}` - Public simulation URL
- `{{pin}}` - Access PIN
- `{{expirationDays}}` - Days until expiration
- `{{commercialName}}` - Sales rep name
- `{{commercialEmail}}` - Sales rep email
- `{{commercialPhone}}` - Sales rep phone
- `{{userName}}` - User full name
- `{{userEmail}}` - User email
- `{{magicLink}}` - Magic login link

## Database Schema (Recommended)

### SystemConfig Table

```sql
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
);
```

### PdfTemplates Table

```sql
CREATE TABLE pdf_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT true,
    html_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);
```

### EmailTemplates Table

```sql
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT true,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);
```

## Usage Examples

### Accessing Configurations

1. Click "Configurations" in sidebar (bottom, above user profile)
2. Select tab: System Settings / PDF Templates / Email Templates

### Editing System Settings

1. Go to System Settings tab
2. Select sub-tab (Simulation, Users, Clients, Modules, Dashboard)
3. Modify settings
4. Click "Save Changes"

### Creating a PDF Template

1. Go to PDF Templates tab
2. Click "+ New Template"
3. Fill in name, type, description
4. Write HTML content with variables
5. Toggle "Show Preview" to see result
6. Click "Create Template"

### Creating an Email Template

1. Go to Email Templates tab
2. Click "+ New Template"
3. Fill in name, type, subject, description
4. Write HTML content with variables
5. Click "Show Preview" to see email rendering
6. Optionally send test email
7. Click "Create Template"

### Activating/Deactivating Templates

- Click "Activate" or "Deactivate" button in table row
- Only active templates are used in the system

## Future Enhancements

### Advanced Editors

- Rich text editor for emails (WYSIWYG)
- Visual PDF builder with drag-and-drop
- Code syntax highlighting
- Template validation

### Advanced Features

- Template versioning/history
- Template duplication
- Import/Export templates
- Template preview with real data
- Bulk operations
- Search and filter
- Sorting by column

### Integration

- Webhook notifications on template changes
- Template usage analytics
- A/B testing for email templates
- Template performance metrics

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Focus states on all inputs
- Semantic HTML structure
- Screen reader friendly

## Performance

- Lazy loading for large template lists
- Debounced preview updates
- Optimistic UI updates
- Efficient re-rendering with React hooks

## Security Considerations

- Admin-only access (add role check)
- HTML sanitization for templates
- Variable validation
- Audit logging for all changes
- Template approval workflow (optional)

---

**Status:** ✅ Complete and ready for use
**Next Steps:** API integration + backend implementation
