import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AXPO API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f7f9fb;
      }
      .topbar {
        background-color: #fafafa;
        padding: 10px 0;
        border-bottom: 1px solid #dee5e6;
      }
      .topbar-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 16px;
        font-size: 14px;
        color: #666;
      }
      .topbar a {
        color: #0066B3;
        text-decoration: none;
        margin: 0 8px;
      }
      .topbar a:hover {
        text-decoration: underline;
      }
      #swagger-ui {
        max-width: 1200px;
        margin: 0 auto;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <div class="topbar">
      <div class="topbar-inner">
        <strong>Public API Documentation</strong> - Token+PIN Access
        | <a href="/api/v1/internal/docs">Internal API Docs</a>
        | <a href="/postman/axpo-simulator.postman_collection.json">Postman Collection</a>
        | <a href="/postman/axpo-simulator.postman_environment.json">Postman Environment</a>
      </div>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/api/v1/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
        });
      };
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
