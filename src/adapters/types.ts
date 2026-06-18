export interface Turn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ModelAdapterRequest {
  system: string;
  messages: Turn[];
  maxTokens: number;
}

export interface ModelAdapterResponse {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelAdapter {
  readonly id: string;
  readonly evidenceClass: "deterministic" | "local_model" | "remote_model";
  generate(request: ModelAdapterRequest): Promise<ModelAdapterResponse>;
}
