# Visual Editor Integration - Summary

## What Changed

The PDF and Email template builders have been upgraded with a **professional visual WYSIWYG editor** (TinyMCE) to allow non-developers to create and edit templates without writing HTML code.

## Files Modified

### New Files Created

1. **`/app/internal/components/modules/HtmlEditor.tsx`**
   - Reusable TinyMCE visual editor component
   - WYSIWYG interface with rich formatting options
   - Code view button for advanced users
   - Helpful tip text explaining features
   - Custom styling to match AXPO brand

2. **`/app/internal/configurations/VISUAL_EDITOR.md`**
   - Complete documentation for non-developers
   - How to use the visual editor
   - List of all template variables
   - Tips and best practices
   - Troubleshooting guide

### Files Modified

1. **`/app/internal/components/modules/PdfTemplatesNew.tsx`**
   - Added import for `HtmlEditor` component
   - Replaced raw `<textarea>` with `<HtmlEditor>` component
   - Added unique `key` prop for proper re-rendering

2. **`/app/internal/components/modules/EmailTemplatesNew.tsx`**
   - Added import for `HtmlEditor` component
   - Replaced raw `<textarea>` with `<HtmlEditor>` component
   - Added unique `key` prop for proper re-rendering

3. **`/app/internal/components/modules/configurations.css`**
   - Increased modal max-width from 1200px to 1400px
   - Increased modal max-height from 90vh to 95vh
   - Better accommodates the visual editor

4. **`/app/internal/configurations/IMPLEMENTATION.md`**
   - Updated overview to mention visual editor
   - Added section on installed packages
   - Updated component structure diagram
   - Added editor features to both PDF and Email sections

### Packages Installed

```bash
npm install @tinymce/tinymce-react tinymce
```

Additional packages (available but not actively used):

- `grapesjs` - Visual page builder
- `grapesjs-preset-newsletter` - Email builder preset
- `react-email-editor` - Alternative email builder

TinyMCE assets copied to `/public/tinymce/` for offline use.

## What Users Can Now Do

### Before (Raw HTML)

```html
<textarea>
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { font-family: Arial; }
      </style>
    </head>
    <body>
      <h1>Hello {{clientName}}</h1>
    </body>
  </html>
</textarea>
```

❌ Requires HTML knowledge
❌ Error-prone
❌ No preview
❌ Hard to format

### After (Visual Editor)

- ✅ **Click buttons** to format text (Bold, Italic, Colors)
- ✅ **Insert tables** with visual interface
- ✅ **Add images and links** easily
- ✅ **Live preview** shows how it looks
- ✅ **Code view button** for advanced users
- ✅ **No HTML knowledge required**

## Key Features

### Visual Editing

- WYSIWYG interface (What You See Is What You Get)
- Rich text formatting (bold, italic, colors, fonts, sizes)
- Tables, images, links support
- Lists (bullet and numbered)
- Text alignment options
- Undo/redo functionality

### Code Access

- **`</>`** button in toolbar toggles code view
- Advanced users can edit raw HTML
- Useful for adding template variables
- Syntax highlighting in code view

### Template Variables

Both editors support dynamic variables:

**PDF Templates:**

- `{{clientName}}`
- `{{contactPerson}}`
- `{{simulationCode}}`
- `{{productName}}`
- `{{totalCost}}`

**Email Templates:**

- `{{contactPerson}}`
- `{{clientName}}`
- `{{simulationLink}}`
- `{{pin}}`
- `{{expirationDays}}`
- `{{commercialName}}`
- `{{commercialEmail}}`
- `{{commercialPhone}}`
- And more...

## User Experience Improvements

### Modal Size

- Increased from 1200px to **1400px** width
- Increased from 90vh to **95vh** height
- More room for the editor and preview

### Visual Guidance

- **Help text** above editor explains the code button
- Light blue background with border
- Clear instructions for non-developers

### Editor Styling

- Matches AXPO brand colors
- Toolbar has light gray background
- Rounded corners (8px border-radius)
- Professional appearance

### Toolbar Features

- **Format**: Blocks (H1-H6, Paragraph), Font sizes
- **Text**: Bold, Italic, Text color, Background color
- **Alignment**: Left, Center, Right, Justify
- **Lists**: Bullet points, Numbered lists, Indent
- **Insert**: Tables, Links, Images
- **Tools**: Code view, Remove formatting, Undo/Redo, Help

## Technical Details

### Component Architecture

```
HtmlEditor Component
├── Props: initialHtml, onChange, height
├── State: editorRef (TinyMCE instance)
├── Effects: Re-init on initialHtml change
└── Render: TinyMCE Editor + Help text
```

### Re-rendering Strategy

```tsx
<HtmlEditor
  key={editingTemplate?.id || "new-template"} // Force re-render on template change
  initialHtml={formData.htmlContent || ""}
  onChange={(html) => setFormData({ ...formData, htmlContent: html })}
/>
```

### TinyMCE Configuration

- **Height**: 500px (configurable)
- **Menubar**: Full menu (File, Edit, View, Insert, Format, Tools, Table, Help)
- **Plugins**: 15+ plugins enabled
- **Skin**: Oxide (default clean design)
- **Content CSS**: Default styling
- **Custom styles**: AXPO brand colors applied via CSS

## Testing Checklist

- [x] Create new PDF template with visual editor
- [x] Edit existing PDF template
- [x] Create new Email template with visual editor
- [x] Edit existing Email template
- [x] Switch between templates (editor updates correctly)
- [x] Use Code view button to edit HTML
- [x] Add template variables in Code view
- [x] Preview templates with sample data
- [x] Save changes
- [x] Modal displays at proper size
- [x] Editor loads without errors
- [x] No TypeScript compilation errors

## Future Enhancements

### Possible Additions

- [ ] **Pre-built blocks**: Drag-and-drop header/footer/sections
- [ ] **Template library**: Pre-made templates to start from
- [ ] **Image upload**: Direct image upload instead of URLs
- [ ] **Variable picker**: Dropdown to insert variables
- [ ] **Template preview in list**: Small thumbnail preview in table
- [ ] **Template duplication**: Copy existing template
- [ ] **Import/Export**: Export template as JSON/HTML
- [ ] **Template versioning**: Track changes over time
- [ ] **A/B testing**: Test different email versions
- [ ] **Analytics**: Track opens, clicks (for emails)

### Alternative Editors Considered

1. **GrapeJS** - More powerful page builder (installed but not used)
   - Pros: Drag-and-drop, component-based
   - Cons: More complex, steeper learning curve
2. **react-email-editor** (Unlayer) - Email-specific builder
   - Pros: Email-focused features
   - Cons: Requires API key, limited free tier
3. **TinyMCE** (CHOSEN) ✓
   - Pros: Easy to use, no API key, familiar interface
   - Cons: Less visual than drag-and-drop builders

## Documentation

See [`VISUAL_EDITOR.md`](./VISUAL_EDITOR.md) for:

- Complete user guide
- Step-by-step instructions
- Tips for non-developers
- Toolbar button reference
- Troubleshooting

## Migration Notes

No breaking changes. Existing templates will continue to work:

- Old templates with raw HTML load correctly in visual editor
- Visual editor outputs clean HTML (compatible with backend)
- Template variables remain unchanged
- API integration plan remains the same

## Summary

✅ **Non-developers can now create professional templates**
✅ **Visual WYSIWYG editor with rich formatting**
✅ **Code view available for advanced users**
✅ **Template variables fully supported**
✅ **Live preview with sample data**
✅ **No breaking changes to existing code**
✅ **Professional appearance matching AXPO brand**
✅ **Comprehensive documentation for users**

The template builder is now production-ready for non-technical users while still providing advanced capabilities for developers.
