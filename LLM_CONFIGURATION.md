# LLM Configuration Guide

This guide explains how to configure and use the LLM (Large Language Model) features in the AXPO Simulator application.

## Overview

The LLM configuration section allows you to integrate AI-powered features for reading and extracting data when creating new simulations. This system is designed to be flexible and support multiple LLM providers.

## Accessing LLM Configuration

1. Navigate to **Configurations** from the main menu
2. Click on the **LLM Settings** tab
3. Enable or configure your LLM provider settings

## Supported Providers

### 1. Ollama (Default)

**Best for:** Local development and privacy-focused deployments

- **Requires API Key:** No
- **Default Base URL:** `http://localhost:11434`
- **Default Model:** `llama3.2`
- **Common Models:** llama3.2, llama3.1, llama2, mistral, mixtral, codellama

**Setup:**

1. Install Ollama from https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. The Ollama server runs on `localhost:11434` by default
4. No API key required

### 2. OpenAI

**Best for:** Production use with high accuracy requirements

- **Requires API Key:** Yes
- **Default Base URL:** `https://api.openai.com/v1`
- **Default Model:** `gpt-4`
- **Common Models:** gpt-4, gpt-4-turbo, gpt-3.5-turbo

**Setup:**

1. Get an API key from https://platform.openai.com/api-keys
2. Select OpenAI as provider
3. Enter your API key
4. Choose your preferred model

### 3. Anthropic (Claude)

**Best for:** Long-context processing and detailed analysis

- **Requires API Key:** Yes
- **Default Base URL:** `https://api.anthropic.com/v1`
- **Default Model:** `claude-3-opus-20240229`
- **Common Models:** claude-3-opus, claude-3-sonnet, claude-3-haiku

**Setup:**

1. Get an API key from https://console.anthropic.com
2. Select Anthropic as provider
3. Enter your API key
4. Choose your preferred Claude model

### 4. Azure OpenAI

**Best for:** Enterprise deployments with Azure infrastructure

- **Requires API Key:** Yes
- **Default Base URL:** Custom (your Azure endpoint)
- **Default Model:** `gpt-4`

**Setup:**

1. Create an Azure OpenAI resource
2. Deploy a model in Azure
3. Get your endpoint URL and API key
4. Configure both in the settings

### 5. Google AI (Gemini)

**Best for:** Multimodal processing and Google ecosystem integration

- **Requires API Key:** Yes
- **Default Base URL:** `https://generativelanguage.googleapis.com/v1`
- **Default Model:** `gemini-pro`

**Setup:**

1. Get an API key from https://makersuite.google.com/app/apikey
2. Select Google AI as provider
3. Enter your API key

### 6. Custom

**Best for:** Self-hosted or other LLM providers

- **Requires API Key:** Optional (depends on your setup)
- **Default Base URL:** Custom
- **Default Model:** Custom

**Setup:**

1. Set your custom endpoint URL
2. Configure API key if required
3. Specify the model name as required by your provider

## Configuration Parameters

### Enable LLM Features

Toggle to enable or disable all LLM-powered features in the application.

### Provider

Select which LLM service to use. Each provider has different capabilities and pricing.

### API Key

Authentication key for cloud-based providers. Not needed for Ollama or some custom setups.

### Base URL

The endpoint URL for the LLM API. Pre-filled for known providers, customizable for others.

### Model Name

The specific AI model to use. Dropdown includes common models for each provider, or enter a custom model name.

### Temperature (0.0 - 2.0)

Controls the randomness of responses:

- **0.0 - 0.3:** Very precise, deterministic (recommended for data extraction)
- **0.4 - 0.7:** Balanced creativity and accuracy
- **0.8 - 2.0:** More creative, less predictable

**Recommended:** 0.1 for simulation data extraction

### Max Tokens

Maximum length of the AI response. Higher values allow longer responses but may increase costs.

**Recommended:** 2000 for most use cases

## Use Cases

The LLM features will be used for:

1. **Document Data Extraction:** Automatically extract relevant information from uploaded documents when creating simulations
2. **Tariff Information Processing:** Understanding and parsing complex energy tariff structures
3. **Data Validation:** Detecting potential errors or inconsistencies in input data
4. **Smart Suggestions:** Providing intelligent recommendations based on simulation parameters

## Security Considerations

- **API Keys:** Stored securely in the database, never exposed in client-side code
- **Ollama:** Best option for sensitive data as it runs locally
- **Data Privacy:** Review your LLM provider's data retention policies
- **Access Control:** Only users with appropriate permissions can modify LLM settings

## Cost Optimization

- **Ollama:** Free, runs on your hardware
- **OpenAI/Anthropic/Google:** Pay per token, monitor usage in their dashboards
- **Azure:** Enterprise pricing, predictable costs
- **Temperature:** Lower values use fewer tokens
- **Max Tokens:** Set to the minimum needed for your use case

## Troubleshooting

### Ollama Connection Issues

- Ensure Ollama is running: `ollama serve`
- Check the model is pulled: `ollama list`
- Verify the base URL: `http://localhost:11434`

### API Key Errors

- Verify the API key is correct
- Check API key has necessary permissions
- Ensure billing is set up for paid providers

### Model Not Found

- For Ollama: Pull the model first (`ollama pull model-name`)
- For cloud providers: Verify the model name is correct
- Check model availability in your region/subscription

## Next Steps

After configuring your LLM settings:

1. Test the configuration by creating a new simulation
2. Monitor the LLM's data extraction accuracy
3. Adjust temperature and max tokens if needed
4. Review costs if using a paid provider

## Support

For issues or questions about LLM configuration, contact your system administrator or refer to the provider's documentation:

- Ollama: https://ollama.ai/docs
- OpenAI: https://platform.openai.com/docs
- Anthropic: https://docs.anthropic.com
- Azure OpenAI: https://learn.microsoft.com/azure/ai-services/openai/
- Google AI: https://ai.google.dev/docs
