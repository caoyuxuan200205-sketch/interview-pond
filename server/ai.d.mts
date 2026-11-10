import type { IncomingMessage, ServerResponse } from "node:http";
export function createAiMiddleware(config: {
  apiKey: string;
  model?: string;
}): (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => Promise<void>;
