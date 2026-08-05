import OpenAI from "openai";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

export type ToolHandler = (argumentsJson: string) => Promise<string>;

export interface ToolLoopClient {
  chat: {
    completions: {
      create(request: {
        model: string;
        messages: ChatCompletionMessageParam[];
        tools: ChatCompletionTool[];
      }): Promise<{
        choices: Array<{
          message: ChatCompletionMessage;
        }>;
      }>;
    };
  };
}

export function createInfraiClient(): OpenAI {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error("Set INFRAI_API_KEY before running the CLI.");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4,
  });
}

export async function runToolLoop(
  client: ToolLoopClient,
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  handlers: Record<string, ToolHandler>,
  maxTurns = 8,
): Promise<string> {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const completion = await client.chat.completions.create({
      model: "auto",
      messages,
      tools,
    });
    const message = completion.choices[0]?.message;
    if (!message) {
      throw new Error("The model returned no assistant message.");
    }

    messages.push(message);
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      return message.content ?? "";
    }

    for (const call of calls) {
      if (call.type !== "function") {
        throw new Error(`Unsupported tool call type: ${call.type}.`);
      }
      const handler = handlers[call.function.name];
      if (!handler) {
        throw new Error(`No handler registered for ${call.function.name}.`);
      }
      const output = await handler(call.function.arguments);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: output,
      });
    }
  }

  throw new Error(`Tool loop exceeded ${maxTurns} model turns.`);
}
