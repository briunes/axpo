const en = {
  controlBack: "Back",
  controlClose: "Close",
  controlFinish: "Finish",
  controlNext: "Next",
  controlNextWithProgress: "Next ({current} of {total})",
  controlOpen: "Open",
  controlSkip: "Skip tutorial",
  "Continue without report": "Continue without report",
  "Skip report": "Skip report",
  catalogSubtitle:
    "Choose what you want to learn. The guide will take you to the correct area and walk you through it step by step.",
  categoryBasics: "Getting started",
  categorySimulations: "Simulations",
  categoryManagement: "Everyday management",
  categoryAdministration: "Administration",
  stepCount: "{count} steps",
  startTutorial: "Start tutorial",
  catalogTitle: "Help & Tutorials",
  downloadManual: "Download manual",
  manualOptions: "Manual download options",
  manualEnglish: "English",
  manualSpanish: "Spanish",
  manualRoleADMIN: "Administrator manual",
  manualRoleAGENT: "Agent manual",
  manualRoleCOMMERCIAL: "Commercial manual",
  manualDownloadFailed: "The manual could not be downloaded. Please try again.",
} as Record<string, string>;

const es = {
  ...en,
  controlBack: "Atrás",
  controlClose: "Cerrar",
  controlFinish: "Finalizar",
  controlNext: "Siguiente",
  controlNextWithProgress: "Siguiente ({current} de {total})",
  controlOpen: "Abrir",
  controlSkip: "Omitir tutorial",
  "Continue without report": "Continuar sin informar",
  "Skip report": "Omitir informe",
  catalogSubtitle:
    "Elige lo que quieres aprender. La guía te llevará al área correcta y te acompañará paso a paso.",
  categoryBasics: "Primeros pasos",
  categorySimulations: "Simulaciones",
  categoryManagement: "Gestión diaria",
  categoryAdministration: "Administración",
  stepCount: "{count} pasos",
  startTutorial: "Iniciar tutorial",
  catalogTitle: "Ayuda y tutoriales",
  downloadManual: "Descargar manual",
  manualOptions: "Opciones de descarga del manual",
  manualEnglish: "Inglés",
  manualSpanish: "Español",
  manualRoleADMIN: "Manual de Administrador",
  manualRoleAGENT: "Manual de Agente",
  manualRoleCOMMERCIAL: "Manual de Comercial",
  manualDownloadFailed: "No se pudo descargar el manual. Inténtalo de nuevo.",
  "Application overview": "Vista general de la aplicación",
  "Learn the navigation, workspace, tables, notifications, and where to find help.":
    "Conoce la navegación, el espacio de trabajo, las tablas, las notificaciones y dónde encontrar ayuda.",
  "Create a simulation": "Crear una simulación",
  "Upload a real invoice, detect its provider, extract and correct OCR data, report issues, and create the simulation.":
    "Sube una factura real, detecta el proveedor, extrae y corrige los datos OCR, informa de incidencias y crea la simulación.",
  "Find and organize simulations": "Buscar y organizar simulaciones",
  "Search, filter, sort, save views, and find archived simulations.":
    "Busca, filtra, ordena, guarda vistas y encuentra simulaciones archivadas.",
  "Review simulation results": "Revisar resultados de simulación",
  "Open an offer and understand its products, charts, inputs, and history.":
    "Abre una oferta y comprende sus productos, gráficos, datos de entrada e historial.",
  "Share a simulation": "Compartir una simulación",
  "Generate a client link, manage access, and send the offer safely.":
    "Genera un enlace para el cliente, gestiona el acceso y envía la oferta de forma segura.",
  "Sharing begins with a draft simulation that already has an offer selected.":
    "Para compartir, empieza con una simulación en borrador que ya tenga una oferta seleccionada.",
  "Find a simulation with a selected offer using its reference, client, or other filters. Share is unavailable until an offer has been selected in the simulation results.":
    "Busca una simulación con una oferta seleccionada mediante la referencia, el cliente u otros filtros. Compartir no está disponible hasta seleccionar una oferta en los resultados.",
  "Open the action menu on the highlighted eligible simulation. If no row is highlighted, open a simulation, select an offer in Results, and return to this guide.":
    "Abre el menú de acciones de la simulación válida resaltada. Si no hay ninguna, abre una simulación, selecciona una oferta en Resultados y vuelve a esta guía.",
  "Open the action menu for a draft simulation that has a selected offer. The guide will continue when a menu containing Share opens. If Share is absent, close that menu and try another simulation.":
    "Abre el menú de acciones de una simulación en borrador que tenga una oferta seleccionada. La guía continuará cuando se abra un menú con la opción Compartir. Si no aparece, cierra el menú y prueba otra simulación.",
  "The tutorial found a visible draft simulation with a selected offer. Select Open Share preview to open the same view as the row’s Share action; this does not send or publish anything.":
    "El tutorial ha encontrado una simulación en borrador con una oferta seleccionada. Pulsa Abrir vista previa para abrir la misma vista que la acción Compartir de la fila; no se enviará ni publicará nada.",
  "Open Share preview": "Abrir vista previa",
  "Close preview": "Cerrar vista previa",
  "No eligible simulation is visible. Select an offer in a draft simulation, return to the list, and restart the sharing tutorial.":
    "No hay ninguna simulación válida visible. Selecciona una oferta en una simulación en borrador, vuelve a la lista y reinicia el tutorial para compartir.",
  "Select Share. This only opens the preview and does not send or publish anything.":
    "Selecciona Compartir. Esto solo abre la vista previa; no envía ni publica nada.",
  "This is the sharing preview. The tutorial will only explain the available options and will not share the simulation.":
    "Esta es la vista previa para compartir. El tutorial solo explicará las opciones disponibles y no compartirá la simulación.",
  "Choose between downloading a PDF for sharing or sending the offer by email. You can also select the appropriate PDF or email template.":
    "Elige entre descargar un PDF para compartirlo o enviar la oferta por correo. También puedes seleccionar la plantilla PDF o de correo adecuada.",
  "Review the generated content and editable sections before sharing. Confirm the client, selected product, language, values, and branding.":
    "Revisa el contenido generado y las secciones editables antes de compartir. Confirma el cliente, producto, idioma, valores e imagen de marca.",
  "These actions either download the PDF or send the email. Do not select them during this tutorial; sharing changes the simulation status.":
    "Estas acciones descargan el PDF o envían el correo. No las selecciones durante el tutorial; compartir cambia el estado de la simulación.",
  "Close the preview without sharing. You can return when the offer and recipient details have been verified.":
    "Cierra la vista previa sin compartir. Puedes volver cuando hayas verificado la oferta y los datos del destinatario.",
  "Manage existing simulations": "Gestionar simulaciones existentes",
  "Edit, duplicate, download, archive, restore, or report an issue.":
    "Edita, duplica, descarga, archiva, restaura o informa de una incidencia.",
  "Manage clients": "Gestionar clientes",
  "Create, find, edit, deactivate, restore, and safely delete clients.":
    "Crea, busca, edita, desactiva, restaura y elimina clientes de forma segura.",
  "Tables, filters, and saved views": "Tablas, filtros y vistas guardadas",
  "Master the reusable table controls used throughout the application.":
    "Domina los controles de tabla reutilizables de toda la aplicación.",
  "Manage users": "Gestionar usuarios",
  "Create users, assign roles and agencies, manage access requests and sessions.":
    "Crea usuarios, asigna roles y agencias y gestiona solicitudes de acceso y sesiones.",
  "Manage agencies": "Gestionar agencias",
  "Create agencies and configure their identity, users, tariffs, and products.":
    "Crea agencias y configura su identidad, usuarios, tarifas y productos.",
  "Understand base values": "Comprender los valores base",
  "Understand scope, versions, effective dates, drafts, and published values.":
    "Comprende el ámbito, las versiones, las fechas de vigencia, los borradores y los valores publicados.",
  "Import and publish base values": "Importar y publicar valores base",
  "Upload an Excel version, validate it, and publish it safely.":
    "Sube una versión de Excel, valídala y publícala de forma segura.",
  "Understand analytics": "Comprender las analíticas",
  "Filter and interpret simulation activity and performance metrics.":
    "Filtra e interpreta la actividad de simulación y las métricas de rendimiento.",
  "System configuration": "Configuración del sistema",
  "Navigate templates, business rules, permissions, OCR, email, and platform settings.":
    "Navega por plantillas, reglas de negocio, permisos, OCR, correo y ajustes de plataforma.",
  "That completes this guide. Return here whenever you want to repeat it or choose another tutorial.":
    "La guía ha terminado. Vuelve aquí cuando quieras repetirla o elegir otro tutorial.",
  "The sidebar contains every area available to your role. Administrators see additional management and configuration sections.":
    "La barra lateral contiene todas las áreas disponibles para tu rol. Los administradores ven secciones adicionales de gestión y configuración.",
  "The workspace changes with the selected section. Page actions appear in the top bar, while filters, forms, and tables appear here.":
    "El espacio de trabajo cambia según la sección seleccionada. Las acciones aparecen en la barra superior y aquí se muestran filtros, formularios y tablas.",
  "This catalog is automatically filtered by your permissions. Each card shows the guide length and starts it in the correct area.":
    "Este catálogo se filtra automáticamente según tus permisos. Cada tarjeta muestra la duración de la guía y la inicia en el área correcta.",
  "This section contains simulations available to your role and agency.":
    "Esta sección contiene las simulaciones disponibles para tu rol y agencia.",
  "Use a saved view, free-text search, and advanced filters to narrow the list.":
    "Usa una vista guardada, la búsqueda de texto y los filtros avanzados para reducir la lista.",
  "Choose which columns are visible. Your selection is remembered for this table.":
    "Elige qué columnas se muestran. La selección se recuerda para esta tabla.",
  "Change row density when you need a compact overview or more spacious records.":
    "Cambia la densidad de las filas para obtener una vista compacta o registros más espaciosos.",
  "Sort columns and open a row to view its offers. Authorized actions appear at the right of each row.":
    "Ordena las columnas y abre una fila para ver sus ofertas. Las acciones autorizadas aparecen a la derecha de cada fila.",
  "As an administrator, use Show archived to switch between active and archived simulations.":
    "Como administrador, usa Mostrar archivados para alternar entre simulaciones activas y archivadas.",
  "Start from the Simulations list.": "Empieza en la lista de Simulaciones.",
  "Search by client, reference, CUPS, owner, agency, commodity, or status to find the offer.":
    "Busca por cliente, referencia, CUPS, propietario, agencia, tipo de energía o estado para encontrar la oferta.",
  "Choose a simulation and click Simulate. The tutorial will continue inside its detail page.":
    "Elige una simulación y pulsa Simular. El tutorial continuará en su página de detalle.",
  "Review the simulation reference, client, status, PIN, CUPS, expiration date, and attached invoice.":
    "Revisa la referencia, el cliente, el estado, el PIN, el CUPS, la fecha de expiración y la factura adjunta.",
  "Use Results to compare calculated offers and Inputs to review every value used by the simulation.":
    "Usa Resultados para comparar las ofertas calculadas y Datos de entrada para revisar todos los valores usados por la simulación.",
  "Filter the offer list by All, Fixed, Indexed, or Personalized products. The number beside each tab shows how many matching offers are available.":
    "Filtra las ofertas por Todos, Fijos, Indexados o Personalizados. El número de cada pestaña indica cuántas ofertas coinciden.",
  "Compare products using the total invoice, monthly and annual savings, percentage difference, charts, and historical data.":
    "Compara productos mediante la factura total, el ahorro mensual y anual, la diferencia porcentual, los gráficos y los datos históricos.",
  "Simulation Data provides quick access to the billing month and the most frequently adjusted consumption, power, and personalized-product values.":
    "Datos de simulación ofrece acceso rápido al mes de facturación y a los valores de consumo, potencia y productos personalizados que se ajustan con más frecuencia.",
  "After changing a quick-access value, select Recalculate offers to refresh every result. Review the updated totals before sharing an offer.":
    "Después de cambiar un valor de acceso rápido, selecciona Recalcular ofertas para actualizar todos los resultados. Revisa los nuevos totales antes de compartir una oferta.",
  "Now select the Inputs tab to see the complete set of values and assumptions used in this simulation.":
    "Selecciona ahora la pestaña Datos de entrada para ver todos los valores y supuestos usados en esta simulación.",
  "The Inputs view contains the full invoice, client, consumption, power, pricing, tax, and product-specific data. Review these fields when the quick controls are not enough.":
    "La vista Datos de entrada contiene la factura completa y los datos del cliente, consumo, potencia, precios, impuestos y productos. Revisa estos campos cuando los controles rápidos no sean suficientes.",
  "Return to Results to continue comparing the recalculated offers.":
    "Vuelve a Resultados para seguir comparando las ofertas recalculadas.",
  "This progress bar follows the real workflow: invoice, client, simulation data, and validation. Nothing is saved until the final Create action.":
    "Esta barra sigue el flujo real: factura, cliente, datos de simulación y validación. No se guarda nada hasta la acción final de creación.",
  "Click this area and choose a real PDF or invoice image. For a multi-page image invoice, add every page. The guide will continue when the uploaded file appears.":
    "Pulsa esta zona y elige un PDF o una imagen de factura real. Si tiene varias páginas, añádelas todas. La guía continuará cuando aparezca el archivo.",
  "Confirm that the filename and page set are correct. You can preview or remove the invoice while provider detection runs; the guide will continue when it is ready.":
    "Confirma que el nombre y las páginas son correctos. Puedes previsualizar o eliminar la factura mientras se detecta el proveedor; la guía continuará cuando esté lista.",
  "Provider detection runs automatically. Wait until it finishes, verify the detected provider and invoice type, and correct the provider using the selector when necessary.":
    "La detección del proveedor es automática. Espera a que termine, verifica el proveedor y el tipo de factura y corrígelos con el selector si es necesario.",
  "Once the provider is correct, click Extract data. Extraction can take some time; the tutorial will continue only after the response is ready.":
    "Cuando el proveedor sea correcto, pulsa Extraer datos. La extracción puede tardar; el tutorial continuará cuando termine.",
  "No matching client was found, so review the pre-filled client details. Save the new client, or cancel and select an existing client. The guide will continue when this dialog closes.":
    "No se encontró un cliente coincidente. Revisa sus datos, guarda el nuevo cliente o cancela y selecciona uno existente. La guía continuará al cerrar el diálogo.",
  "The extracted invoice data is now available. Verify the client, commodity, CUPS, tariff, billing dates, consumption, power, prices, taxes, and invoice total.":
    "Los datos extraídos ya están disponibles. Verifica cliente, energía, CUPS, tarifa, fechas, consumo, potencia, precios, impuestos y total.",
  "Reporting is optional. Click Report issue to review the feedback form, or select Skip report to continue without submitting anything.":
    "Informar es opcional. Pulsa Informar de incidencia para revisar el formulario u Omitir informe para continuar sin enviarlo.",
  "Describe exactly what was wrong—for example the field, extracted value, and expected value. You can submit the report, cancel it, or continue the tutorial without submitting anything.":
    "Describe exactamente el error: campo, valor extraído y valor esperado. Puedes enviar el informe, cancelarlo o continuar sin enviarlo.",
  "Correct missing or inaccurate values directly in these fields. Select or create the correct client and recheck all financial and consumption values after editing.":
    "Corrige aquí los valores ausentes o incorrectos. Selecciona o crea el cliente correcto y vuelve a comprobar los importes y consumos.",
  "Only click Validate after comparing the extracted and corrected values with the source invoice. Validation enables final simulation creation.":
    "Pulsa Validar solo después de comparar los valores con la factura original. La validación permite crear la simulación.",
  "Complete any remaining required offer fields and expiration date. When the Create simulation button is enabled, review once more and click it to create the real simulation.":
    "Completa los campos obligatorios y la fecha de expiración. Cuando se habilite Crear simulación, revisa todo y pulsa el botón.",
  "The simulation was created successfully. Verify its reference, client, status, PIN, CUPS, expiration date, and attached invoice in this summary.":
    "La simulación se creó correctamente. Verifica aquí su referencia, cliente, estado, PIN, CUPS, expiración y factura adjunta.",
  "This is the new simulation’s detail and calculation area. Review the saved inputs, calculate or recalculate offers when needed, and compare the resulting products.":
    "Esta es el área de detalle y cálculo. Revisa los datos guardados, calcula o recalcula cuando sea necesario y compara los productos.",
  "Select the intended offer only after checking totals, savings, assumptions, and charts. From this page you can also report a simulation issue or share the completed offer when authorized.":
    "Selecciona una oferta solo tras comprobar totales, ahorros, supuestos y gráficos. Aquí también puedes informar de incidencias o compartir la oferta si tienes permiso.",
  "Sharing begins with an existing simulation.":
    "Para compartir, empieza con una simulación existente.",
  "Find the simulation using its reference, client, or other filters.":
    "Encuentra la simulación por referencia, cliente u otros filtros.",
  "Open the row actions and choose Share.":
    "Abre las acciones de la fila y elige Compartir.",
  "Review the public expiration date and access method. Generate or rotate the PIN if required, then copy the link or send it by email.":
    "Revisa la expiración pública y el método de acceso. Genera o cambia el PIN si hace falta y copia el enlace o envíalo por correo.",
  "Before sending, verify the recipient, language, selected offer, and expiration. Rotating a PIN invalidates the previous PIN.":
    "Antes de enviar, verifica destinatario, idioma, oferta y expiración. Cambiar el PIN invalida el anterior.",
  "Simulation management actions are permission-aware.":
    "Las acciones de gestión dependen de tus permisos.",
  "Select the menu toggle beside Simulate on any row to see every action available for that simulation.":
    "Pulsa el menú situado junto a Simular en cualquier fila para ver todas las acciones disponibles para esa simulación.",
  "This menu shows only the actions allowed for your role and the simulation’s current state, such as Share, Duplicate, Archive, Restore, Download, or Delete.":
    "Este menú solo muestra las acciones permitidas para tu rol y el estado actual de la simulación, como Compartir, Duplicar, Archivar, Restaurar, Descargar o Eliminar.",
  "Close actions": "Cerrar acciones",
  "Use row actions to open, edit, duplicate, share, archive, download, or report an issue. Only permitted actions are shown.":
    "Usa las acciones de fila para abrir, editar, duplicar, compartir, archivar, descargar o informar. Solo se muestran las permitidas.",
  "Switch to archived records to restore a simulation. Archived records are hidden from the normal list.":
    "Cambia a los registros archivados para restaurar una simulación. No aparecen en la lista normal.",
  "Duplicate when you need a similar offer without changing the original. Edit only when the source data or assumptions must change.":
    "Duplica para crear una oferta similar sin alterar la original. Edita solo si deben cambiar los datos o supuestos.",
  "Permanent deletion cannot be undone and should only be used when retention rules allow it. Tutorials never perform deletion for you.":
    "La eliminación permanente no se puede deshacer y solo debe usarse cuando lo permitan las reglas de conservación. Los tutoriales nunca eliminan datos.",
  "Clients are company records linked to agencies and simulations.":
    "Los clientes son empresas vinculadas a agencias y simulaciones.",
  "Select New client when you need to create a company record.":
    "Selecciona Nuevo cliente para crear una empresa.",
  "Search clients, select a view preset, or open advanced filters such as agency.":
    "Busca clientes, selecciona una vista o abre filtros avanzados como la agencia.",
  "Choose a client and click Edit. The tutorial will continue inside the client page.":
    "Elige un cliente y pulsa Editar. El tutorial continuará en su página.",
  "Review and maintain the company, tax, contact, address, agency, language, and status information here.":
    "Revisa y mantén aquí los datos de empresa, fiscales, contacto, dirección, agencia, idioma y estado.",
  "Save changes is always available in the top action bar. Review the complete form before selecting it; the tutorial never saves changes automatically.":
    "Guardar cambios está siempre disponible en la barra de acciones superior. Revisa todo el formulario antes de pulsarlo; el tutorial nunca guarda cambios automáticamente.",
  "Save only intentional changes. Back on the list, permitted row actions can deactivate, restore, or delete the client.":
    "Guarda solo cambios intencionados. En la lista, las acciones permitidas permiten desactivar, restaurar o eliminar el cliente.",
  "Search updates the visible records. Advanced filters narrow structured fields, and view presets restore useful combinations.":
    "La búsqueda actualiza los registros visibles. Los filtros avanzados acotan campos y las vistas restauran combinaciones útiles.",
  "Show or hide columns to focus the table. These preferences are stored in your browser.":
    "Muestra u oculta columnas para centrar la tabla. Estas preferencias se guardan en el navegador.",
  "Select compact, standard, or comfortable density. The preference applies consistently across tables.":
    "Selecciona densidad compacta, estándar o cómoda. La preferencia se aplica a todas las tablas.",
  "Click sortable column headers to change ordering. Use row checkboxes when a permitted bulk action is available.":
    "Pulsa las cabeceras ordenables para cambiar el orden. Usa las casillas cuando haya acciones masivas disponibles.",
  "Saved views preserve filters and sorting for repeated work. Clear filters before creating a new view with a different purpose.":
    "Las vistas guardadas conservan filtros y orden. Limpia los filtros antes de crear una vista con otro propósito.",
  "User management is restricted to authorized administrators.":
    "La gestión de usuarios está restringida a administradores autorizados.",
  "Create an account and assign the correct role and agency. Grant the minimum access needed for the user’s work.":
    "Crea una cuenta y asigna el rol y la agencia correctos. Concede solo el acceso necesario.",
  "Review requested access here. Verify the requester and agency before approving or rejecting a request.":
    "Revisa aquí las solicitudes de acceso. Verifica solicitante y agencia antes de aprobar o rechazar.",
  "Search by name or email and filter by role, agency, activity, or archived status.":
    "Busca por nombre o correo y filtra por rol, agencia, actividad o estado archivado.",
  "Choose a user and click Edit. The tutorial will continue inside the user page.":
    "Elige un usuario y pulsa Editar. El tutorial continuará en su página.",
  "Review the user's identity, role, agency, contact information, and access settings.":
    "Revisa la identidad, rol, agencia, contacto y ajustes de acceso del usuario.",
  "Use the Preferences tab for personal defaults and Sessions, when available, to inspect or revoke access.":
    "Usa Preferencias para valores personales y Sesiones, si está disponible, para revisar o revocar accesos.",
  "Save only intentional access changes. PIN rotation, activation, and archived-user controls remain available from the list according to your permissions.":
    "Guarda solo cambios de acceso intencionados. El cambio de PIN, la activación y los controles de archivado siguen disponibles según tus permisos.",
  "Agencies scope users, clients, commercial rules, and simulation availability.":
    "Las agencias delimitan usuarios, clientes, reglas comerciales y simulaciones disponibles.",
  "Create an agency with its identity and contact details. Use a clear unique name and code.":
    "Crea una agencia con sus datos identificativos y de contacto. Usa un nombre y código únicos.",
  "Search and filter by status, TLV configuration, or other available fields.":
    "Busca y filtra por estado, configuración TLV u otros campos.",
  "Choose an agency and click Edit. The tutorial will continue inside the agency page.":
    "Elige una agencia y pulsa Editar. El tutorial continuará en su página.",
  "Review the agency identity, contact details, address, and operational configuration.":
    "Revisa la identidad, contacto, dirección y configuración operativa de la agencia.",
  "Use the Users and Products tabs to review assignments and availability. Tariff and product changes affect what agents can select in simulations.":
    "Usa Usuarios y Productos para revisar asignaciones y disponibilidad. Los cambios afectan a lo que los agentes pueden elegir.",
  "Confirm all electricity, gas, and TLV settings before saving. Deactivation and archived-agency controls remain on the list.":
    "Confirma los ajustes de electricidad, gas y TLV antes de guardar. La desactivación y el archivado están en la lista.",
  "Base values are economic reference data consumed by simulation calculations.":
    "Los valores base son datos económicos de referencia usados por los cálculos.",
  "Search and filter value sets by scope, status, version, and effective period.":
    "Busca y filtra conjuntos por ámbito, estado, versión y periodo de vigencia.",
  "Global sets provide defaults; agency-scoped sets override them for the selected agency. Versions preserve calculation history.":
    "Los conjuntos globales proporcionan valores predeterminados; los de agencia los sustituyen. Las versiones conservan el historial.",
  "Choose a value set and click Edit. The tutorial will continue inside its detail page.":
    "Elige un conjunto y pulsa Editar. El tutorial continuará en su detalle.",
  "Review the name, scope, version, effective dates, values, and source workbook. Draft changes are safe to review before activation.":
    "Revisa nombre, ámbito, versión, vigencia, valores y archivo de origen. Los borradores pueden revisarse antes de activarlos.",
  "Published values may be used by new calculations, so verify scope and effective dates before saving or activating. Archived versions remain available for traceability.":
    "Los cálculos pueden usar valores publicados; verifica ámbito y vigencia antes de guardar o activar. Las versiones archivadas mantienen la trazabilidad.",
  "Start in Base Values with the prepared workbook.":
    "Empieza en Valores base con el archivo preparado.",
  "Upload an XLSX or XLSM workbook. Import always creates a new draft version; it does not silently replace an existing version.":
    "Sube un XLSX o XLSM. La importación siempre crea un borrador nuevo y no sustituye otra versión.",
  "Choose global or agency scope in the upload dialog. Confirm the target agency before importing agency-specific values.":
    "Elige ámbito global o de agencia y confirma la agencia antes de importar valores específicos.",
  "Review validation messages and correct the workbook when required. Do not publish a version with unexpected missing products or periods.":
    "Revisa la validación y corrige el archivo. No publiques si faltan productos o periodos de forma inesperada.",
  "Open the imported draft, compare its values and effective dates, then activate it only after validation.":
    "Abre el borrador importado, compara valores y vigencia y actívalo solo tras validarlo.",
  "Archive superseded versions instead of permanently deleting historical data. Verify a sample simulation after publishing.":
    "Archiva las versiones sustituidas en vez de borrar el historial. Verifica una simulación de muestra después de publicar.",
  "Analytics reflects the scope available to your role.":
    "Las analíticas reflejan el ámbito disponible para tu rol.",
  "Start with the headline metrics, then use the charts and tables to explain changes in simulation activity.":
    "Empieza por las métricas principales y usa gráficos y tablas para explicar los cambios de actividad.",
  "Select the reporting period, commodity, and—when available—agency. Changing filters refreshes all related metrics.":
    "Selecciona periodo, energía y, si está disponible, agencia. Los filtros actualizan todas las métricas.",
  "Administrators can drill into an agency; agents see their permitted operational view. Compare like-for-like periods before drawing conclusions.":
    "Los administradores pueden analizar una agencia; los agentes ven su ámbito permitido. Compara periodos equivalentes.",
  "Use the underlying counts and date range when sharing a result. A chart may be affected by archived records, incomplete offers, or the selected scope.":
    "Al compartir un resultado, usa los recuentos y fechas. Los registros archivados, ofertas incompletas o el ámbito pueden afectar al gráfico.",
  "This area contains administrator-only settings that can affect every user.":
    "Esta área contiene ajustes solo para administradores que pueden afectar a todos los usuarios.",
  "Settings are grouped into Documents, Business, Platform, AI & OCR, and Access. Choose one focused area at a time.":
    "Los ajustes se agrupan en Documentos, Negocio, Plataforma, IA y OCR, y Acceso. Trabaja en un área cada vez.",
  "The selected editor appears here. Read its description and current values before changing anything.":
    "Aquí aparece el editor seleccionado. Lee la descripción y los valores actuales antes de cambiar nada.",
  "Documents manages PDF and email templates. Business contains simulation, client, calculation, and Excel parser rules.":
    "Documentos gestiona plantillas PDF y de correo. Negocio contiene reglas de simulación, clientes, cálculo y Excel.",
  "Platform contains maintenance, SMTP, sessions, cache, and scheduled jobs. AI & OCR contains LLM and invoice extraction settings.":
    "Plataforma contiene mantenimiento, SMTP, sesiones, caché y tareas. IA y OCR contiene ajustes de LLM y extracción.",
  "Access contains user defaults and role permissions. Permission changes should be tested with the affected role before rollout.":
    "Acceso contiene valores de usuario y permisos de rol. Prueba los cambios con el rol afectado antes de publicarlos.",
  "Save one logical change at a time and verify the related workflow. Keep rollback values for calculation, email, OCR, and access changes.":
    "Guarda un cambio lógico cada vez y verifica el flujo relacionado. Conserva valores de reversión para cálculo, correo, OCR y acceso.",
} as Record<string, string>;

const fr = {
  ...en,
  controlBack: "Retour",
  controlClose: "Fermer",
  controlFinish: "Terminer",
  controlNext: "Suivant",
  controlNextWithProgress: "Suivant ({current} sur {total})",
  controlOpen: "Ouvrir",
  controlSkip: "Ignorer le tutoriel",
  "Continue without report": "Continuer sans signalement",
  "Skip report": "Ignorer le signalement",
  catalogSubtitle:
    "Choisissez ce que vous souhaitez apprendre. Le guide vous conduira au bon endroit et vous accompagnera étape par étape.",
  categoryBasics: "Bien démarrer",
  categorySimulations: "Simulations",
  categoryManagement: "Gestion quotidienne",
  categoryAdministration: "Administration",
  stepCount: "{count} étapes",
  startTutorial: "Démarrer le tutoriel",
  catalogTitle: "Aide et tutoriels",
} as Record<string, string>;

const pt = {
  ...en,
  controlBack: "Voltar",
  controlClose: "Fechar",
  controlFinish: "Concluir",
  controlNext: "Seguinte",
  controlNextWithProgress: "Seguinte ({current} de {total})",
  controlOpen: "Abrir",
  controlSkip: "Ignorar tutorial",
  "Continue without report": "Continuar sem comunicar",
  "Skip report": "Ignorar comunicação",
  catalogSubtitle:
    "Escolha o que pretende aprender. O guia leva-o à área correta e acompanha-o passo a passo.",
  categoryBasics: "Primeiros passos",
  categorySimulations: "Simulações",
  categoryManagement: "Gestão diária",
  categoryAdministration: "Administração",
  stepCount: "{count} passos",
  startTutorial: "Iniciar tutorial",
  catalogTitle: "Ajuda e tutoriais",
} as Record<string, string>;

export const tutorialTranslations = { en, es, fr, pt };
