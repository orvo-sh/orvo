import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  consumeStream,
  convertToModelMessages,
  stepCountIs,
  streamText as createTextStream,
  tool,
  type ToolSet,
  type UIMessage
} from 'ai';

class AiClient {
  private geminiModel;

  constructor(config: { geminiApiKey: string }) {
    const google = createGoogleGenerativeAI({ apiKey: config.geminiApiKey });
    this.geminiModel = google('gemini-2.5-flash');
  }

  streamText = (input: {
    system?: string;
    messages: Awaited<ReturnType<typeof convertToModelMessages>>;
    tools?: ToolSet;
    stopWhen?: Parameters<typeof createTextStream>[0]['stopWhen'];
    temperature?: number;
  }) => createTextStream({ ...input, model: this.geminiModel });
}

export { AiClient, consumeStream, convertToModelMessages, stepCountIs, tool };
export type { ToolSet, UIMessage };
