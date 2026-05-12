import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { SUPPORTED_LANGUAGES } from "@/lib/supportedLanguages";

// Allow up to 5 minutes — template generation for multiple languages can be slow
export const maxDuration = 300;

// ────────────────────────────────────────────────────────────────────────────────
// AXPO Brand Guide — injected into every AI generation request
// ────────────────────────────────────────────────────────────────────────────────
const AXPO_BRAND_GUIDE = `
## AXPO Brand Guide

### Logo
- SVG logo (preferred for PDF): https://axpo-qld.vercel.app/axpo-logo.svg
- SVG logo (for email clients): https://axpo-qld.vercel.app/axpo-logo.svg
- Always render as <img> tag with alt="Axpo Logo"
- Recommended logo width: 130px for PDF headers, 150px for email headers

### Brand Colors
- Primary Red / Salmon:  #e8645a  (borders, header underlines, accents)
- Dark Red:              #dc2626  (alternative primary)
- Accent Magenta/Pink:  #E91E63  (section titles, highlight text)
- CTA Button Red:       #FF3254  (call-to-action buttons)
- Axpo Plan Green:      #4CAF50  (positive highlight, savings callouts)
- Body Text Dark:       #2d2d2d  (main text)
- Secondary Text:       #666 / #888  (descriptions, meta)
- Light Background:     #f9fafb / #f3f3f3
- White:                #ffffff  (primary background)
- Border Light:         #e5e7eb / #e8e8e8

### Typography
- Font stack: Helvetica, Arial, sans-serif
- PDF base size: 10pt–12px; Email base size: 14px–16px
- Section title style: bold, #E91E63 or #e8645a, 12pt
- Label style: uppercase, 8–9pt, #aaa, letter-spacing 0.07em
- Body line-height: 1.5–1.6

### Layout — PDF Templates
- Use div-based layout (NOT table-based)
- Give root container a scoped class: e.g. .ph-root or .axpo-tpl (use that for ALL CSS selectors)
- Do NOT use a scoped ID like #axpo-tpl — use a class instead, to avoid PDF renderer conflicts
- ALL CSS must be scoped under the root class to avoid conflicts when embedded
- Header: flex row — logo img on left (width 130px), document meta on right — border-bottom: 3px solid #e8645a, margin-bottom: 28px
- Client info: horizontal strip of fields (display:flex; border:1px solid #e8e8e8; border-radius:6px; overflow:hidden) — each field has a small uppercase label (font-size:9px; color:#aaa; text-transform:uppercase) and a bold value
- Section titles: 12pt bold, #E91E63
- Data tables: width:100%; border-collapse:collapse — th background #f9fafb, alternating row backgrounds
- Footer: border-top: 1px solid #e8e8e8, flex space-between, font-size: 10px; color: #aaa
- Padding: 36px 44px overall

### ⚠️ CRITICAL — Price History Templates
For templates of type "price-history", ALL table data is injected dynamically at runtime via template variables.
NEVER hardcode any table rows, prices, dates, or data. The HTML must only contain the variable placeholder.

Gas price-history — use this exact structure for the history body:
  <div class="history-body">{{HISTORY_TABLES_GAS}}</div>
Or for a single band: {{HISTORY_TABLE_GAS}}, {{HISTORY_TABLE_GAS_R1}}, etc.

Electricity price-history — use:
  <div class="history-body">{{HISTORY_TABLES}}</div>
Or per-tariff: {{HISTORY_TABLE_2TD}}, {{HISTORY_TABLE_3TD}}, {{HISTORY_TABLE_6TD}}

The correct gas price-history template MUST follow this structure exactly (use a .ph-root scoped class, NOT an id):
<style>
  .ph-root, .ph-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .ph-root { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #2d2d2d; background: #ffffff; padding: 36px 44px; }
  .doc-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; border-bottom: 3px solid #e8645a; margin-bottom: 28px; }
  .doc-meta { text-align: right; font-size: 11px; color: #888; line-height: 1.6; }
  .doc-meta strong { color: #444; }
  .doc-title { text-align: center; font-size: 14px; font-weight: bold; color: #2d2d2d; margin-bottom: 6px; }
  .doc-subtitle { text-align: center; font-size: 11px; color: #888; margin-bottom: 32px; }
  .client-strip { display: flex; gap: 0; margin-bottom: 28px; border: 1px solid #e8e8e8; border-radius: 6px; overflow: hidden; }
  .client-field { flex: 1; padding: 10px 14px; border-right: 1px solid #e8e8e8; }
  .client-field:last-child { border-right: none; }
  .client-field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #aaa; margin-bottom: 3px; }
  .client-field-value { font-size: 12px; font-weight: 600; color: #2d2d2d; }
  .doc-footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e8e8e8; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #aaa; }
  .doc-footer-brand { font-weight: 700; color: #e8645a; }
</style>
<div class="ph-root">
  <div class="doc-header">
    <img src="https://axpo-qld.vercel.app/axpo-logo.svg" alt="Axpo Logo" width="130">
    <div class="doc-meta">
      <div><strong>Simulation:</strong> {{SIMULATION_ID}}</div>
      <div><strong>Date:</strong> {{CREATED_AT}}</div>
      <div><strong>Sales Rep:</strong> {{OWNER_NAME}}</div>
    </div>
  </div>
  <div class="doc-title">Gas Price History — {{GAS_PRODUCT_LABEL}}</div>
  <div class="doc-subtitle">Tariff: {{GAS_TARIFA}}</div>
  <div class="client-strip">
    <div class="client-field"><div class="client-field-label">Client</div><div class="client-field-value">{{CLIENT_NAME}}</div></div>
    <div class="client-field"><div class="client-field-label">Product</div><div class="client-field-value">{{GAS_PRODUCT_LABEL}}</div></div>
    <div class="client-field"><div class="client-field-label">Tariff</div><div class="client-field-value">{{GAS_TARIFA}}</div></div>
    <div class="client-field"><div class="client-field-label">Owner</div><div class="client-field-value">{{OWNER_NAME}}</div></div>
  </div>
  <div class="history-body">{{HISTORY_TABLES_GAS}}</div>
  <div class="doc-footer">
    <span><span class="doc-footer-brand">AXPO</span> — Automatically generated document</span>
    <span>{{OWNER_NAME}} · {{OWNER_EMAIL}}</span>
  </div>
</div>

### Layout — Email Templates
- MUST use TABLE-BASED layout (required for compatibility with all email clients)
- Max width: 600px, centered
- Header cell: background #f3f3f3, padding 20px, centered logo
- Content cell: background #ffffff or #f9fafb, padding 30px
- CTA Buttons: inline <a> with display:inline-block; padding:15px 40px; background-color:#FF3254; color:#ffffff; border-radius:6px; font-weight:bold
- IMPORTANT: Whenever a CTA button links to a URL variable (e.g. reset password, magic link, OTP, setup URL, invitation link, or any action URL), you MUST also display the URL as a plain-text fallback directly below the button. Use a small paragraph like: "If the button doesn't work, copy and paste this link into your browser:" followed by the URL variable displayed as a styled anchor link (color:#FF3254; word-break:break-all). This is required for email client compatibility.
- Footer: padding 20px, text-align:center, color:#6b7280, font-size:12px
- Always end with: © {{CURRENT_YEAR}} AXPO Energy Solutions. All rights reserved.
`;

// ────────────────────────────────────────────────────────────────────────────────
// Helper: call LLM (text-only, all providers)
// ────────────────────────────────────────────────────────────────────────────────
async function callLLM(
  provider: string,
  baseUrl: string,
  modelName: string,
  apiKey: string | null | undefined,
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  maxTokens: number,
): Promise<Response> {
  const timeout = AbortSignal.timeout(300_000);

  if (provider === "ollama") {
    return fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        prompt: userMessage,
        stream: false,
        options: { temperature, num_predict: maxTokens },
      }),
      signal: timeout,
    });
  }

  if (
    provider === "openai" ||
    provider === "azure-openai" ||
    provider === "ollama-cloud" ||
    provider === "custom"
  ) {
    return fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: timeout,
    });
  }

  if (provider === "anthropic") {
    return fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: timeout,
    });
  }

  if (provider === "google") {
    return fetch(
      `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: timeout,
      },
    );
  }

  throw new Error(`Provider "${provider}" is not supported.`);
}

function extractResponseText(provider: string, llmData: any): string {
  if (
    provider === "openai" ||
    provider === "azure-openai" ||
    provider === "ollama-cloud" ||
    provider === "custom"
  ) {
    return llmData.choices?.[0]?.message?.content || "";
  }
  if (provider === "ollama") {
    return llmData.response || "";
  }
  if (provider === "anthropic") {
    return llmData.content?.[0]?.text || "";
  }
  if (provider === "google") {
    return llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  return "";
}

// ────────────────────────────────────────────────────────────────────────────────
// POST handler
// ────────────────────────────────────────────────────────────────────────────────
export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  // ── Load LLM config ──────────────────────────────────────────────────────────
  const config = await prisma.systemConfig.findFirst();

  if (!(config as any)?.llmEnabled) {
    return NextResponse.json(
      {
        success: false,
        message:
          "LLM features are not enabled. Please enable them in System Settings → LLM Configuration.",
      },
      { status: 400 },
    );
  }

  const llmBaseUrl = (config as any).llmBaseUrl as string;
  const llmModelName = (config as any).llmModelName as string;
  const llmProvider = ((config as any).llmProvider || "ollama") as string;
  const llmApiKey = (config as any).llmApiKey as string | null | undefined;
  const llmTemperature = Number((config as any).llmTemperature) || 0.4;
  // Use configured maxTokens per-language call — 4000 is plenty for one language
  const llmMaxTokens = Math.min(
    Math.max(Number((config as any).llmMaxTokens) || 4000, 2000),
    8000,
  );

  if (!llmBaseUrl || !llmModelName) {
    return NextResponse.json(
      {
        success: false,
        message:
          "LLM is not configured. Please set the Base URL and Model in System Settings.",
      },
      { status: 400 },
    );
  }

  // ── Parse request body ───────────────────────────────────────────────────────
  const body = await req.json();
  const {
    prompt,
    templateMode, // "pdf" | "email"
    existingTemplates, // Array<{ languageCode, htmlContent, subject? }> — only for edit mode
    variables, // Array<{ key, label, description, example }>
    currentMeta, // { name, description, type, commodity, subject }
    isEditing,
  } = body;

  if (!prompt?.trim()) {
    return NextResponse.json(
      { success: false, message: "Prompt is required." },
      { status: 400 },
    );
  }

  const isEmail = templateMode === "email";

  // ── Build variable catalogue ─────────────────────────────────────────────────
  const variableCatalogue =
    (variables || [])
      .map(
        (v: any) =>
          `  - {{${v.key}}}: ${v.label}${v.description ? ` — ${v.description}` : ""}${v.example ? ` [e.g. "${v.example}"]` : ""}`,
      )
      .join("\n") ||
    "  No specific variables — use {{clientName}}, {{simulationCode}} etc. as appropriate.";

  // ── Current metadata context ─────────────────────────────────────────────────
  const metaContext = currentMeta
    ? `Current template: name="${currentMeta.name || ""}", type="${currentMeta.type || ""}", commodity="${currentMeta.commodity || ""}"`
    : "";

  // ── Shared system prompt (provider context, brand guide, variables) ───────────
  const sharedSystemPrompt = `You are an expert HTML template designer for AXPO, a European energy company.
You create professional, production-ready HTML templates for ${isEmail ? "email communications" : "PDF documents"}.

${AXPO_BRAND_GUIDE}

## Available Template Variables
Use ONLY these variables (as {{KEY}}). Do not invent new variable keys.
${variableCatalogue}`;

  // ── First call: get metadata + English template ───────────────────────────────
  // We ask for metadata + the primary language in the first call, then generate
  // remaining languages in parallel referencing the English as the base style.

  const primaryLang = SUPPORTED_LANGUAGES[0]; // "en"
  const otherLangs = SUPPORTED_LANGUAGES.slice(1);

  const primaryExisting = isEditing
    ? (existingTemplates || []).find(
        (t: any) => t.languageCode === primaryLang.code,
      )
    : null;

  const primaryExistingBlock = primaryExisting
    ? `\n## Existing ${primaryLang.label} template to modify:\n\`\`\`html\n${primaryExisting.htmlContent}\n\`\`\`\nIMPORTANT: Modify only what the user requests — keep the same overall structure.\n`
    : "";

  const typeOptions = isEmail
    ? "simulation-share|user-welcome|password-reset|magic-link|otp|notification|expiring-soon|converted|welcome"
    : "simulation-output|simulation-detailed|contract|price-history|invoice|report";

  const primaryUserMessage = `${metaContext}

${primaryExistingBlock}
User request: ${prompt}

Return ONLY this JSON (no extra text):
\`\`\`json
{
  "name": "Template name in English",
  "description": "One-sentence description in English",
  "type": "${typeOptions}",
  ${isEmail ? "" : '"commodity": "ELECTRICITY or GAS or null",\n  '}"subject": ${isEmail ? '"Email subject line in ' + primaryLang.label + '"' : "null"},
  "htmlContent": "complete self-contained HTML in ${primaryLang.label} — all CSS inline or in <style> tags"
}
\`\`\``;

  // ── Helper to parse a single-language response ────────────────────────────────
  function parseSingleLang(text: string): any {
    const match =
      text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      text.match(/(\{[\s\S]*\})/);
    if (!match) throw new Error("No JSON block in LLM response");
    return JSON.parse(match[1]);
  }

  // ── Call primary language ────────────────────────────────────────────────────
  let primaryResponse: Response;
  try {
    primaryResponse = await callLLM(
      llmProvider,
      llmBaseUrl,
      llmModelName,
      llmApiKey,
      sharedSystemPrompt,
      primaryUserMessage,
      llmTemperature,
      llmMaxTokens,
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to connect to LLM: ${err.message}` },
      { status: 500 },
    );
  }

  if (!primaryResponse.ok) {
    const errText = await primaryResponse.text();
    return NextResponse.json(
      {
        success: false,
        message: `LLM API error ${primaryResponse.status}: ${primaryResponse.statusText}`,
        details: errText.substring(0, 500),
      },
      { status: 500 },
    );
  }

  const primaryData = await primaryResponse.json();
  const primaryText = extractResponseText(llmProvider, primaryData);

  let primaryResult: any;
  try {
    primaryResult = parseSingleLang(primaryText);
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to parse AI response as JSON.",
        debug: primaryText.substring(0, 1000),
      },
      { status: 500 },
    );
  }

  // ── Call remaining languages in parallel ─────────────────────────────────────
  const otherTranslations = await Promise.all(
    otherLangs.map(async (lang) => {
      const existingForLang = isEditing
        ? (existingTemplates || []).find(
            (t: any) => t.languageCode === lang.code,
          )
        : null;

      const existingBlock = existingForLang
        ? `\n## Existing ${lang.label} template to modify:\n\`\`\`html\n${existingForLang.htmlContent}\n\`\`\`\nIMPORTANT: Modify only what the user requests — keep the same overall structure.\n`
        : `\n## Reference (English version to translate from):\n\`\`\`html\n${primaryResult.htmlContent}\n\`\`\`\n`;

      const langUserMessage = `${metaContext}

${existingBlock}
User request: ${prompt}
Language to generate: ${lang.label} (${lang.code})

Translate ALL visible text to ${lang.label}. Keep the same HTML structure, CSS and variable placeholders.

Return ONLY this JSON (no extra text):
\`\`\`json
{
  ${isEmail ? `"subject": "Email subject in ${lang.label}",\n  ` : ""}"htmlContent": "complete self-contained HTML in ${lang.label}"
}
\`\`\``;

      try {
        const resp = await callLLM(
          llmProvider,
          llmBaseUrl,
          llmModelName,
          llmApiKey,
          sharedSystemPrompt,
          langUserMessage,
          llmTemperature,
          llmMaxTokens,
        );

        if (!resp.ok) {
          // Fallback: use English content if a secondary language fails
          console.warn(
            `LLM failed for language ${lang.code}, falling back to English`,
          );
          return {
            languageCode: lang.code,
            htmlContent: primaryResult.htmlContent,
            ...(isEmail ? { subject: primaryResult.subject || "" } : {}),
          };
        }

        const langData = await resp.json();
        const langText = extractResponseText(llmProvider, langData);
        const langResult = parseSingleLang(langText);

        return {
          languageCode: lang.code,
          htmlContent: langResult.htmlContent || primaryResult.htmlContent,
          ...(isEmail
            ? { subject: langResult.subject || primaryResult.subject || "" }
            : {}),
        };
      } catch (err) {
        console.warn(
          `Failed to generate ${lang.code} translation, falling back:`,
          err,
        );
        return {
          languageCode: lang.code,
          htmlContent: primaryResult.htmlContent,
          ...(isEmail ? { subject: primaryResult.subject || "" } : {}),
        };
      }
    }),
  );

  // ── Assemble final result ─────────────────────────────────────────────────────
  const result = {
    name: primaryResult.name,
    description: primaryResult.description,
    type: primaryResult.type,
    ...(isEmail ? {} : { commodity: primaryResult.commodity }),
    translations: [
      {
        languageCode: primaryLang.code,
        htmlContent: primaryResult.htmlContent,
        ...(isEmail ? { subject: primaryResult.subject || "" } : {}),
      },
      ...otherTranslations,
    ],
  };

  return NextResponse.json({ success: true, result });
});
