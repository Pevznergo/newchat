import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { customProvider, type LanguageModel } from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const xai = createOpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function getLanguageModel(modelId: string): LanguageModel {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  // Handle OpenAI
  if (modelId.startsWith("openai/")) {
    const modelName = modelId.split("/")[1];
    return openai(modelName);
  }

  // Handle Anthropic
  if (modelId.startsWith("anthropic/")) {
    const modelName = modelId.split("/")[1]; // e.g. claude-3-5-sonnet-20240620
    return anthropic(modelName);
  }

  // Handle Google
  if (modelId.startsWith("google/")) {
    const modelName = modelId.split("/")[1];
    return google(modelName);
  }

  // Handle DeepSeek
  if (modelId.startsWith("deepseek/")) {
    const modelName = modelId.split("/")[1];
    return deepseek(modelName);
  }

  // Handle XAI (Grok)
  if (modelId.startsWith("xai/")) {
    const modelName = modelId.split("/")[1];
    return xai(modelName);
  }

  // Handle OpenRouter
  if (modelId.startsWith("openrouter/")) {
    // OpenRouter model IDs often contain slashes, so we join the rest
    const modelName = modelId.split("/").slice(1).join("/");
    return openrouter(modelName);
  }

  // Fallback or legacy gateway support if needed, but per request we use connected providers directly
  console.warn(
    `Unknown model provider for ${modelId}, trying OpenAI as default fallback`
  );
  return openai("gpt-4o");
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return openai("gpt-4o-mini");
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return anthropic("claude-3-5-sonnet-20240620"); // Using strong model for artifacts
}
