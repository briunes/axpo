import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";

/**
 * @swagger
 * /api/v1/internal/config/llm/test:
 *   post:
 *     tags: [Configuration]
 *     summary: Test LLM connection
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               baseUrl:
 *                 type: string
 *               modelName:
 *                 type: string
 *     responses:
 *       200:
 *         description: LLM test result
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  await assertPermission(auth, "section.configurations");

  const body = await req.json();
  const { provider, apiKey, baseUrl, modelName } = body;

  // Validate inputs
  if (!baseUrl) {
    return NextResponse.json({
      success: false,
      message: "Base URL is required",
      details: { provider, model: modelName },
    });
  }

  if (!modelName) {
    return NextResponse.json({
      success: false,
      message: "Model name is required",
      details: { provider, baseUrl },
    });
  }

  try {
    // Test the LLM connection with a simple prompt
    const testPrompt = "Say 'connection successful' if you can read this.";

    let response: Response;
    let url: string;

    if (provider === "ollama" || provider === "ollama-cloud") {
      // For Ollama Cloud, use OpenAI-compatible format
      if (provider === "ollama-cloud") {
        url = `${baseUrl}/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "user", content: testPrompt }],
            max_tokens: 50,
          }),
          signal: AbortSignal.timeout(10000),
        });
      } else {
        // For local Ollama, use native Ollama format
        url = `${baseUrl}/api/generate`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelName,
            prompt: testPrompt,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
      }
    } else if (provider === "openai" || provider === "azure-openai") {
      // OpenAI-compatible API format
      url = `${baseUrl}/chat/completions`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: testPrompt }],
          max_tokens: 50,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } else if (provider === "anthropic") {
      // Anthropic API format
      url = `${baseUrl}/messages`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 50,
          messages: [{ role: "user", content: testPrompt }],
        }),
      });
    } else if (provider === "google") {
      // Google AI API format
      const url = `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }],
        }),
      });
    } else {
      // Generic/custom provider - try OpenAI-compatible format
      const url = `${baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: testPrompt }],
          max_tokens: 50,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage =
          errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // If not JSON, use the text as-is (truncated)
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      }

      return NextResponse.json({
        success: false,
        message: `LLM API Error: ${errorMessage}`,
        details: {
          provider,
          model: modelName,
          baseUrl,
          status: response.status,
        },
      });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${provider} (${modelName})`,
      details: {
        provider,
        model: modelName,
        baseUrl,
        responseReceived: true,
      },
    });
  } catch (error: any) {
    // Provide more helpful error messages
    let errorMessage = error.message;
    let helpText = "";

    if (error.message.includes("fetch failed")) {
      errorMessage = "Unable to connect to the LLM service";
      helpText =
        "Possible causes: Invalid URL, network issues, CORS restrictions, or service is down";
    } else if (error.message.includes("timeout")) {
      errorMessage = "Connection timeout";
      helpText =
        "The server took too long to respond. Check if the service is running.";
    } else if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("getaddrinfo")
    ) {
      errorMessage = "DNS resolution failed";
      helpText =
        "The URL hostname could not be resolved. Check if the base URL is correct.";
    } else if (error.message.includes("ECONNREFUSED")) {
      errorMessage = "Connection refused";
      helpText =
        "The server is not accepting connections. Verify the service is running and the port is correct.";
    }

    return NextResponse.json({
      success: false,
      message: `${errorMessage}${helpText ? ` - ${helpText}` : ""}`,
      details: {
        provider,
        model: modelName,
        baseUrl,
        error: error.message,
        ...(error.cause ? { cause: String(error.cause) } : {}),
      },
    });
  }
});
