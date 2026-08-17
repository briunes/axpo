import type { PermissionKey } from "../../lib/permissionsDefinitions";
import type { Step } from "react-joyride";

export type TutorialDefinition = {
  id: string;
  title: string;
  description: string;
  category: "basics" | "simulations" | "management" | "administration";
  route: string;
  permissions?: PermissionKey[];
  roles?: string[];
  continuationPrefix?: string;
  completionSteps?: TutorialDefinition["steps"];
  steps: Step[];
};

export const canAccessTutorial = (
  tutorial: TutorialDefinition,
  role: string,
  canDo: (role: string, permission: PermissionKey) => boolean,
) =>
  (!tutorial.permissions || tutorial.permissions.every((permission) => canDo(role, permission))) &&
  (!tutorial.roles || tutorial.roles.includes(role));

const nav = (section: string, content: string) => ({ target: `[data-testid='nav-${section}']`, content, placement: "right" as const });
const page = (content: string) => ({ target: "[data-tour='page-content']", content, placement: "center" as const });
const target = (name: string, content: string, placement: "auto" | "center" | "right" | "left" | "top" | "bottom" = "bottom") => ({ target: `[data-tour='${name}']`, content, placement });
const requiredAction = (name: string, nextTarget: string, content: string, placement: "auto" | "center" | "right" | "left" | "top" | "bottom" = "bottom") => ({
  ...target(name, content, placement),
  // The runner advances as soon as the action renders the next target. Hiding
  // Next prevents the tour from waiting behind its overlay for missing UI.
  buttons: ["back", "skip"] as Step["buttons"],
  data: { advanceWhenTargetAppears: `[data-tour='${nextTarget}']` },
});
const requiredNavigation = (name: string, content: string) => ({
  ...target(name, content),
  buttons: ["back", "skip"] as Step["buttons"],
});
const conditionalRequiredAction = (name: string, nextTarget: string, content: string) => ({
  ...requiredAction(name, nextTarget, content),
  data: {
    skipUnlessTargetExists: `[data-tour='${name}']`,
    advanceWhenTargetAppears: `[data-tour='${nextTarget}']`,
  },
});
const conditionalAction = (name: string, content: string) => ({
  ...target(name, content),
  buttons: ["back", "skip"] as Step["buttons"],
  data: {
    skipUnlessTargetExists: `[data-tour='${name}']`,
    advanceWhenTargetDisappears: `[data-tour='${name}']`,
  },
});
const conditionalTarget = (name: string, content: string, placement: "auto" | "center" | "right" | "left" | "top" | "bottom" = "bottom") => ({
  ...target(name, content, placement),
  data: { skipUnlessTargetExists: `[data-tour='${name}']` },
});
const dismissibleAction = (name: string, dismissTarget: string, content: string) => ({
  ...target(name, content),
  locale: { next: "Continue without report" },
  data: { dismissTargetOnNext: `[data-tour='${dismissTarget}']` },
});
const optionalAction = (name: string, actionTarget: string, content: string) => ({
  ...target(name, content),
  locale: { next: "Skip report" },
  data: {
    advanceWhenTargetAppears: `[data-tour='${actionTarget}']`,
    skipNextStepOnNext: true,
  },
});
const eventAction = (content: string, eventName: string, nextLabel: string) => ({
  ...page(content),
  locale: { next: nextLabel },
  data: { dispatchEventOnNext: eventName },
});
const targetEventAction = (name: string, content: string, eventName: string, nextLabel: string) => ({
  ...target(name, content, "center"),
  locale: { next: nextLabel },
  data: { dispatchEventOnNext: eventName },
});
const finish = { target: "[data-tour='help-menu']", content: "That completes this guide. Return here whenever you want to repeat it or choose another tutorial.", placement: "right" as const };

export const TUTORIALS: TutorialDefinition[] = [
  {
    id: "app-overview", title: "Application overview", category: "basics", route: "/internal/tutorials",
    description: "Learn the navigation, workspace, tables, notifications, and where to find help.",
    steps: [
      target("main-navigation", "The sidebar contains every area available to your role. Administrators see additional management and configuration sections.", "right"),
      page("The workspace changes with the selected section. Page actions appear in the top bar, while filters, forms, and tables appear here."),
      target("tutorial-catalog", "This catalog is automatically filtered by your permissions. Each card shows the guide length and starts it in the correct area.", "left"),
      finish,
    ],
  },
  {
    id: "create-simulation", title: "Create a simulation", category: "simulations", route: "/internal/simulations/new", continuationPrefix: "/internal/simulations/", permissions: ["section.simulations", "simulations.create"],
    description: "Upload a real invoice, detect its provider, extract and correct OCR data, report issues, and create the simulation.",
    steps: [
      target("simulation-progress", "This progress bar follows the real workflow: invoice, client, simulation data, and validation. Nothing is saved until the final Create action."),
      requiredAction("ocr-upload", "ocr-selected-file", "Click this area and choose a real PDF or invoice image. For a multi-page image invoice, add every page. The guide will continue when the uploaded file appears."),
      requiredAction("ocr-selected-file", "ocr-provider", "Confirm that the filename and page set are correct. You can preview or remove the invoice while provider detection runs; the guide will continue when it is ready."),
      target("ocr-provider", "Provider detection runs automatically. Wait until it finishes, verify the detected provider and invoice type, and correct the provider using the selector when necessary."),
      requiredAction("ocr-extract", "ocr-extracted-data", "Once the provider is correct, click Extract data. Extraction can take some time; the tutorial will continue only after the response is ready."),
      conditionalAction("ocr-create-client", "No matching client was found, so review the pre-filled client details. Save the new client, or cancel and select an existing client. The guide will continue when this dialog closes."),
      target("ocr-extracted-data", "The extracted invoice data is now available. Verify the client, commodity, CUPS, tariff, billing dates, consumption, power, prices, taxes, and invoice total."),
      optionalAction("ocr-report-issue", "ocr-issue-form", "Reporting is optional. Click Report issue to review the feedback form, or select Skip report to continue without submitting anything."),
      dismissibleAction("ocr-issue-form", "ocr-issue-cancel", "Describe exactly what was wrong—for example the field, extracted value, and expected value. You can submit the report, cancel it, or continue the tutorial without submitting anything."),
      target("ocr-correct-data", "Correct missing or inaccurate values directly in these fields. Select or create the correct client and recheck all financial and consumption values after editing."),
      target("ocr-validate", "Only click Validate after comparing the extracted and corrected values with the source invoice. Validation enables final simulation creation."),
      target("crud-submit", "Complete any remaining required offer fields and expiration date. When the Create simulation button is enabled, review once more and click it to create the real simulation."),
      finish,
    ],
    completionSteps: [
      target("simulation-detail-summary", "The simulation was created successfully. Verify its reference, client, status, PIN, CUPS, expiration date, and attached invoice in this summary."),
      target("simulation-detail-results", "This is the new simulation’s detail and calculation area. Review the saved inputs, calculate or recalculate offers when needed, and compare the resulting products."),
      page("Select the intended offer only after checking totals, savings, assumptions, and charts. From this page you can also report a simulation issue or share the completed offer when authorized."),
      finish,
    ],
  },
  {
    id: "find-simulations", title: "Find and organize simulations", category: "simulations", route: "/internal/simulations", permissions: ["section.simulations"],
    description: "Search, filter, sort, save views, and find archived simulations.",
    steps: [nav("simulations", "This section contains simulations available to your role and agency."), target("simulations-toolbar", "Use a saved view, free-text search, and advanced filters to narrow the list."), target("simulations-columns", "Choose which columns are visible. Your selection is remembered for this table."), target("simulations-density", "Change row density when you need a compact overview or more spacious records."), target("simulations-table", "Sort columns and open a row to view its offers. Authorized actions appear at the right of each row.", "center"), conditionalTarget("simulations-archived", "As an administrator, use Show archived to switch between active and archived simulations."), finish],
  },
  {
    id: "review-simulation", title: "Review simulation results", category: "simulations", route: "/internal/simulations", continuationPrefix: "/internal/simulations/", permissions: ["section.simulations"],
    description: "Open an offer and understand its products, charts, inputs, and history.",
    steps: [nav("simulations", "Start from the Simulations list."), target("simulations-toolbar", "Search by client, reference, CUPS, owner, agency, commodity, or status to find the offer."), requiredNavigation("simulation-open", "Choose a simulation and click Simulate. The tutorial will continue inside its detail page.")],
    completionSteps: [
      target("simulation-detail-summary", "Review the simulation reference, client, status, PIN, CUPS, expiration date, and attached invoice."),
      target("simulation-view-tabs", "Use Results to compare calculated offers and Inputs to review every value used by the simulation."),
      target("simulation-offer-filters", "Filter the offer list by All, Fixed, Indexed, or Personalized products. The number beside each tab shows how many matching offers are available."),
      target("simulation-detail-results", "Compare products using the total invoice, monthly and annual savings, percentage difference, charts, and historical data.", "center"),
      target("simulation-quick-inputs", "Simulation Data provides quick access to the billing month and the most frequently adjusted consumption, power, and personalized-product values.", "right"),
      conditionalTarget("simulation-recalculate", "After changing a quick-access value, select Recalculate offers to refresh every result. Review the updated totals before sharing an offer."),
      requiredAction("simulation-inputs-tab", "simulation-full-inputs", "Now select the Inputs tab to see the complete set of values and assumptions used in this simulation."),
      target("simulation-full-inputs", "The Inputs view contains the full invoice, client, consumption, power, pricing, tax, and product-specific data. Review these fields when the quick controls are not enough.", "center"),
      requiredAction("simulation-results-tab", "simulation-offer-filters", "Return to Results to continue comparing the recalculated offers."),
      finish,
    ],
  },
  {
    id: "share-simulation", title: "Share a simulation", category: "simulations", route: "/internal/simulations", permissions: ["section.simulations", "simulations.share"],
    description: "Generate a client link, manage access, and send the offer safely.",
    steps: [
      nav("simulations", "Sharing begins with a draft simulation that already has an offer selected."),
      target("simulations-toolbar", "Find a simulation with a selected offer using its reference, client, or other filters. Share is unavailable until an offer has been selected in the simulation results."),
      eventAction("The tutorial found a visible draft simulation with a selected offer. Select Open Share preview to open the same view as the row’s Share action; this does not send or publish anything.", "axpo:tutorial-open-share", "Open Share preview"),
      target("simulation-share-dialog", "This is the sharing preview. The tutorial will only explain the available options and will not share the simulation.", "center"),
      target("simulation-share-options", "Choose between downloading a PDF for sharing or sending the offer by email. You can also select the appropriate PDF or email template."),
      target("simulation-share-preview", "Review the generated content and editable sections before sharing. Confirm the client, selected product, language, values, and branding.", "center"),
      target("simulation-share-submit-options", "These actions either download the PDF or send the email. Do not select them during this tutorial; sharing changes the simulation status."),
      targetEventAction("simulation-share-dialog", "Close the preview without sharing. You can return when the offer and recipient details have been verified.", "axpo:tutorial-close-share", "Close preview"),
      finish,
    ],
  },
  {
    id: "manage-simulations", title: "Manage existing simulations", category: "simulations", route: "/internal/simulations", permissions: ["section.simulations", "simulations.duplicate", "simulations.archive", "simulations.delete", "simulations.download_excel"], roles: ["ADMIN", "SYS_ADMIN"],
    description: "Edit, duplicate, download, archive, restore, or report an issue.",
    steps: [
      nav("simulations", "Simulation management actions are permission-aware."),
      requiredAction("simulation-row-actions", "simulation-actions-menu", "Select the menu toggle beside Simulate on any row to see every action available for that simulation."),
      targetEventAction("simulation-actions-menu", "This menu shows only the actions allowed for your role and the simulation’s current state, such as Share, Duplicate, Archive, Restore, Download, or Delete.", "axpo:tutorial-close-actions", "Close actions"),
      target("simulations-archived", "Switch to archived records to restore a simulation. Archived records are hidden from the normal list."),
      page("Duplicate when you need a similar offer without changing the original. Edit only when the source data or assumptions must change."),
      page("Permanent deletion cannot be undone and should only be used when retention rules allow it. Tutorials never perform deletion for you."),
      finish,
    ],
  },
  {
    id: "manage-clients", title: "Manage clients", category: "management", route: "/internal/clients", continuationPrefix: "/internal/clients/", permissions: ["section.clients", "clients.view", "clients.create", "clients.edit", "clients.delete"],
    description: "Create, find, edit, deactivate, restore, and safely delete clients.",
    steps: [nav("clients", "Clients are company records linked to agencies and simulations."), target("clients-new", "Select New client when you need to create a company record."), target("clients-toolbar", "Search clients, select a view preset, or open advanced filters such as agency."), requiredNavigation("client-open", "Choose a client and click Edit. The tutorial will continue inside the client page.")],
    completionSteps: [
      target("client-detail-form", "Review and maintain the company, tax, contact, address, agency, language, and status information here.", "center"),
      target("crud-submit", "Save changes is always available in the top action bar. Review the complete form before selecting it; the tutorial never saves changes automatically.", "bottom"),
      page("Save only intentional changes. Back on the list, permitted row actions can deactivate, restore, or delete the client."),
      finish,
    ],
  },
  {
    id: "table-tools", title: "Tables, filters, and saved views", category: "management", route: "/internal/simulations", permissions: ["section.simulations"],
    description: "Master the reusable table controls used throughout the application.",
    steps: [target("simulations-toolbar", "Search updates the visible records. Advanced filters narrow structured fields, and view presets restore useful combinations."), target("simulations-columns", "Show or hide columns to focus the table. These preferences are stored in your browser."), target("simulations-density", "Select compact, standard, or comfortable density. The preference applies consistently across tables."), target("simulations-table", "Click sortable column headers to change ordering. Use row checkboxes when a permitted bulk action is available.", "center"), page("Saved views preserve filters and sorting for repeated work. Clear filters before creating a new view with a different purpose."), finish],
  },
  {
    id: "manage-users", title: "Manage users", category: "administration", route: "/internal/users", continuationPrefix: "/internal/users/", permissions: ["section.users", "users.view", "users.create", "users.edit", "users.deactivate", "users.sessions.manage"],
    description: "Create users, assign roles and agencies, manage access requests and sessions.",
    steps: [nav("users", "User management is restricted to authorized administrators."), target("users-new", "Create an account and assign the correct role and agency. Grant the minimum access needed for the user’s work."), target("users-access-requests", "Review requested access here. Verify the requester and agency before approving or rejecting a request."), target("users-toolbar", "Search by name or email and filter by role, agency, activity, or archived status."), requiredNavigation("user-open", "Choose a user and click Edit. The tutorial will continue inside the user page.")],
    completionSteps: [target("user-detail-form", "Review the user's identity, role, agency, contact information, and access settings."), target("user-detail-tabs", "Use the Preferences tab for personal defaults and Sessions, when available, to inspect or revoke access."), page("Save only intentional access changes. PIN rotation, activation, and archived-user controls remain available from the list according to your permissions."), finish],
  },
  {
    id: "manage-agencies", title: "Manage agencies", category: "administration", route: "/internal/agencies", continuationPrefix: "/internal/agencies/", permissions: ["section.agencies", "agencies.view", "agencies.create", "agencies.edit", "agencies.deactivate"],
    description: "Create agencies and configure their identity, users, tariffs, and products.",
    steps: [nav("agencies", "Agencies scope users, clients, commercial rules, and simulation availability."), target("agencies-new", "Create an agency with its identity and contact details. Use a clear unique name and code."), target("agencies-toolbar", "Search and filter by status, TLV configuration, or other available fields."), { ...requiredNavigation("agency-open", "Choose an agency and click Edit. The tutorial will continue inside the agency page."), skipScroll: true }],
    completionSteps: [target("agency-detail-form", "Review the agency identity, contact details, address, and operational configuration."), target("agency-detail-tabs", "Use the Users and Products tabs to review assignments and availability. Tariff and product changes affect what agents can select in simulations."), page("Confirm all electricity, gas, and TLV settings before saving. Deactivation and archived-agency controls remain on the list."), finish],
  },
  {
    id: "base-values-overview", title: "Understand base values", category: "administration", route: "/internal/base-values", continuationPrefix: "/internal/base-values/", permissions: ["section.base-values"],
    description: "Understand scope, versions, effective dates, drafts, and published values.",
    steps: [nav("base-values", "Base values are economic reference data consumed by simulation calculations."), target("base-values-toolbar", "Search and filter value sets by scope, status, version, and effective period."), target("base-values-table", "Global sets provide defaults; agency-scoped sets override them for the selected agency. Versions preserve calculation history.", "center"), requiredNavigation("base-value-open", "Choose a value set and click Edit. The tutorial will continue inside its detail page.")],
    completionSteps: [target("base-value-detail-form", "Review the name, scope, version, effective dates, values, and source workbook. Draft changes are safe to review before activation."), page("Published values may be used by new calculations, so verify scope and effective dates before saving or activating. Archived versions remain available for traceability."), finish],
  },
  {
    id: "import-base-values", title: "Import and publish base values", category: "administration", route: "/internal/base-values", permissions: ["section.base-values"], roles: ["ADMIN", "SYS_ADMIN"],
    description: "Upload an Excel version, validate it, and publish it safely.",
    steps: [nav("base-values", "Start in Base Values with the prepared workbook."), target("base-values-upload", "Upload an XLSX or XLSM workbook. Import always creates a new draft version; it does not silently replace an existing version."), page("Choose global or agency scope in the upload dialog. Confirm the target agency before importing agency-specific values."), page("Review validation messages and correct the workbook when required. Do not publish a version with unexpected missing products or periods."), target("base-values-table", "Open the imported draft, compare its values and effective dates, then activate it only after validation.", "center"), page("Archive superseded versions instead of permanently deleting historical data. Verify a sample simulation after publishing."), finish],
  },
  {
    id: "analytics", title: "Understand analytics", category: "administration", route: "/internal/analytics", permissions: ["section.analytics"],
    description: "Filter and interpret simulation activity and performance metrics.",
    steps: [nav("analytics", "Analytics reflects the scope available to your role."), target("analytics-dashboard", "Start with the headline metrics, then use the charts and tables to explain changes in simulation activity."), page("Select the reporting period, commodity, and—when available—agency. Changing filters refreshes all related metrics."), page("Administrators can drill into an agency; agents see their permitted operational view. Compare like-for-like periods before drawing conclusions."), page("Use the underlying counts and date range when sharing a result. A chart may be affected by archived records, incomplete offers, or the selected scope."), finish],
  },
  {
    id: "configurations", title: "System configuration", category: "administration", route: "/internal/configurations", permissions: ["section.configurations"],
    description: "Navigate templates, business rules, permissions, OCR, email, and platform settings.",
    steps: [nav("configurations", "This area contains administrator-only settings that can affect every user."), target("configurations-navigation", "Settings are grouped into Documents, Business, Platform, AI & OCR, and Access. Choose one focused area at a time.", "right"), target("configurations-content", "The selected editor appears here. Read its description and current values before changing anything.", "left"), target("configurations-navigation", "Documents manages PDF and email templates. Business contains simulation, client, calculation, and Excel parser rules.", "right"), target("configurations-navigation", "Platform contains maintenance, SMTP, sessions, cache, and scheduled jobs. AI & OCR contains LLM and invoice extraction settings.", "right"), target("configurations-navigation", "Access contains user defaults and role permissions. Permission changes should be tested with the affected role before rollout.", "right"), page("Save one logical change at a time and verify the related workflow. Keep rollback values for calculation, email, OCR, and access changes."), finish],
  },
];
