# Editable Sections as Draggable Variables

## Overview

When creating email or PDF templates, any editable sections you define will automatically appear as draggable variables in the template editor. This makes it easy to place editable content exactly where you want it.

## How It Works

### 1. Add Editable Sections

When editing a template (Email or PDF):

1. Scroll to the "Editable Sections" section
2. Click "+ Add Section"
3. Enter a section key (e.g., `INTRO_TEXT`, `CLOSING_TEXT`)
4. Fill in:
   - **Label**: Display name for users
   - **Description**: Help text explaining the section's purpose
   - **Default Text**: Pre-filled content
   - **Multiline**: Allow multiple lines
   - **Required**: Make the section mandatory

### 2. Use as Draggable Variables

Once you add editable sections, they automatically appear in the **Available Variables** panel with:

- A 📝 icon to distinguish them from regular variables
- The section label you defined
- The description as help text

You can drag these editable sections into your template just like any other variable.

### 3. Template Usage

When the template is used (e.g., when sharing a simulation):

- The editable section variables show up in the list
- Users can drag them into their email/PDF content
- The default text is used initially
- Users can click on the section in preview mode to edit it

## Example

### Step 1: Create an Editable Section

```
Section Key: INTRO_TEXT
Label: Introduction
Description: Opening message for the client
Default: "Thank you for your interest in our services."
Multiline: ✓
```

### Step 2: The Section Appears as a Variable

In the Available Variables panel, you'll see:

```
📝 Introduction
Editable section
{{INTRO_TEXT}}
```

### Step 3: Drag it into Your Template

```html
<p>{{INTRO_TEXT}}</p>
<p>Here are the simulation results:</p>
```

### Step 4: Users Can Customize It

When someone uses this template to share a simulation, they can:

- See the default text in the preview
- Click on it to edit
- Or drag the variable again to use it elsewhere

## Benefits

✅ **No Manual Typing**: Just drag and drop editable sections
✅ **Visual Workflow**: See all available sections at a glance
✅ **Consistent Naming**: Section keys are enforced (uppercase, underscores)
✅ **Clear Organization**: Editable sections are marked with 📝 icon
✅ **Flexible Placement**: Drag sections anywhere in your template

## Technical Details

- Editable sections are stored in the template's `editableSections` field (JSON)
- They appear in the DraggableVariables component alongside regular template variables
- Regular variables come from the database (`TemplateVariable` table)
- Editable sections are template-specific

## Files Modified

- `EmailTemplatesNew.tsx` - Email template editor
- `PdfTemplatesNew.tsx` - PDF template editor
- `ShareSimulationView.tsx` - Simulation sharing page
- `EditableSectionsEditor.tsx` - Section editor component
- `DraggableVariables.tsx` - (no changes, works automatically)

## Related Documentation

- [EMAIL_SYSTEM_GUIDE.md](./EMAIL_SYSTEM_GUIDE.md) - Email templates overview
- [TEMPLATE_VARIABLES_IMPLEMENTATION.md](./TEMPLATE_VARIABLES_IMPLEMENTATION.md) - Variable system details
