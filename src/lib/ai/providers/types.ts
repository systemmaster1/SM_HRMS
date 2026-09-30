export type AIProviderName = "gemini" | "openai" | "anthropic" | "openrouter";
export type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };
export type ProviderMessage = { role: "user" | "assistant"; content: string };
export type ProviderToolCall = { id: string; name: string; arguments: Record<string, unknown> };
export type ProviderResponse = { text: string; toolCalls: ProviderToolCall[]; inputTokens: number; outputTokens: number };
export interface AIProvider {
  complete(input: { model: string; system: string; messages: ProviderMessage[]; tools: ToolDefinition[]; timeoutMs?: number }): Promise<ProviderResponse>;
}
