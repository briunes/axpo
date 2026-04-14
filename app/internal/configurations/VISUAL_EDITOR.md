# Visual Template Builder

## Overview

The PDF and Email templates now include a **visual WYSIWYG editor** powered by **Quill** (free, MIT licensed), making it easy for non-developers to create and edit templates without writing HTML code.

## Features

### Visual Editing

- **WYSIWYG Interface**: Edit content visually without knowing HTML
- **Rich Text Formatting**: Bold, italic, underline, strike-through
- **Colors**: Text color and background/highlight colors
- **Headers**: H1 through H6 headings
- **Font Sizes**: Small, normal, large, huge
- **Links & Images**: Easy insertion
- **Lists**: Bullet points and numbered lists
- **Indentation**: Increase/decrease indent
- **Alignment**: Left, center, right, justify
- **Code Blocks**: For code snippets
- **Blockquotes**: For citations
- **Clean Format**: Remove all formatting

### HTML Code View

- Click the **"View HTML Code"** button above the editor to toggle between visual and code editing
- In code view, you can directly edit the raw HTML
- Click **"Hide HTML"** to return to visual mode
- Perfect for:
  - Adding custom styles
  - Inserting template variables ({{variableName}})
  - Fine-tuning the output
  - Advanced HTML editing

### Template Variables

Both PDF and Email templates support dynamic variables:

**PDF Templates:**

- `{{clientName}}` - Company name
- `{{contactPerson}}` - Contact person name
- `{{simulationCode}}` - Simulation reference code
- `{{productName}}` - Product/plan name
- `{{totalCost}}` - Total cost amount

**Email Templates:**

- `{{contactPerson}}` - Contact person name
- `{{clientName}}` - Company name
- `{{simulationCode}}` - Simulation code
- `{{simulationLink}}` - Link to view simulation
- `{{pin}}` - Access PIN
- `{{expirationDays}}` - Days until expiration
- `{{commercialName}}` - Sales rep name
- `{{commercialEmail}}` - Sales rep email
- `{{commercialPhone}}` - Sales rep phone
- `{{userName}}` - User name
- `{{userEmail}}` - User email
- `{{magicLink}}` - Magic login link

## How to Use

### Creating a New Template

1. Click **"+ New Template"** button
2. Fill in:
   - **Name**: Descriptive name for the template
   - **Type**: Select template type from dropdown
   - **Description**: Brief description of purpose
   - **Active**: Check to enable the template
3. Use the visual editor to design your template:
   - Type content directly
   - Use toolbar buttons for formatting
   - Insert links, images, code blocks, etc.
4. Add template variables by clicking **"View HTML Code"** button and typing them manually (e.g., `{{variableName}}`)
5. Click **"Show Preview"** to see how it looks with sample data
6. Click **"Create Template"** to save

### Editing an Existing Template

1. Find the template in the table
2. Click the **"Edit"** button
3. Make changes using the visual editor
4. Click **"Show Preview"** to verify changes
5. Click **"Save Changes"**

### Tips for Non-Developers

#### Basic Formatting

1. Select text you want to format
2. Click toolbar buttons (Bold, Italic, Color, etc.)
3. Use headings (Heading 1, 2, 3) for section titles

#### Adding a Table

1. Click the **Table** button in toolbar
2. Choose rows and columns
3. Fill in the table cells
4. Right-click table for more options (add/remove rows, etc.)

#### Adding Colors

1. Select text or click where you want color
2. Click the **color** button (paint bucket icon)
3. Choose color from palette
4. AXPO brand color is **#dc2626** (red)

#### Inserting Links

1. Select text to link
2. Click **link** button
3. Enter URL
4. Click OK

#### Template Variables

1. Click **"View HTML Code"** button above the editor
2. Type the variable name exactly: `{{variableName}}`
3. Click **"Hide HTML"** to return to visual mode
4. The variable will be replaced with real data when the template is used

## Editor Toolbar Buttons

- **Headers**: Paragraph, Heading 1-6
- **Size**: Small, normal, large, huge
- **Bold/Italic/Underline/Strike**: Text styling
- **Text Color**: Change text color (use #dc2626 for AXPO red)
- **Background Color**: Highlight text with background color
- **Alignment**: Left, center, right, justify
- **Lists**: Bullet lists and numbered lists
- **Indent**: Increase/decrease indentation
- **Link**: Create hyperlinks
- **Image**: Insert images
- **Blockquote**: Format as quote
- **Code Block**: Format as code
- **Clean**: Remove all formatting

## Best Practices

1. **Keep it Simple**: Don't over-design. Clean templates are more professional.
2. **Test Preview**: Always check the preview with sample data before saving.
3. **Mobile-Friendly**: Email templates should work on mobile devices (keep width ≤ 600px).
4. **Brand Colors**: Use AXPO red (#dc2626) for headings and buttons.
5. **Professional Fonts**: Stick to Arial, Helvetica, or similar web-safe fonts.
6. **Variable Placement**: Place variables where dynamic data should appear.
7. **Save Often**: Click save frequently to avoid losing changes.

## Technical Details

- **Editor**: Quill (free, open source WYSIWYG editor, MIT licensed)
- **Installed Packages**:
  - `react-quill` - React wrapper for Quill
  - `quill` - Core Quill library
- **License**: MIT (completely free, no API keys required)
- **Mode**: Self-hosted, no external dependencies or CDN

## Troubleshooting

**Editor not loading?**

- Check browser console for errors
- Ensure react-quill is properly installed
- Try refreshing the page

**Changes not saving?**

- Make sure to click "Save Changes" or "Create Template" button
- Check for error notifications

**Variables not working?**

- Ensure variable names match exactly: `{{variableName}}`
- Check spelling and capitalization
- Use Code view to verify variable syntax

**Need to edit raw HTML?**

- Click the **`</>`** button in the toolbar
- Make changes carefully
- Click **`</>`** again to return to visual mode

## Future Enhancements

- [ ] Drag-and-drop components
- [ ] Pre-built template blocks (headers, footers, sections)
- [ ] Template library/marketplace
- [ ] A/B testing for email templates
- [ ] Template versioning and rollback
- [ ] Live send test emails
- [ ] Template analytics (opens, clicks)
