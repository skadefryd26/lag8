const gatewayUrl = "https://genai.gjensidige.io/openai/v1/responses";

function readText(response: unknown): string | undefined {
  if (!response || typeof response !== "object" || !("output" in response) || !Array.isArray(response.output)) {
    return undefined;
  }

  for (const item of response.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }
}

export async function requestGateway(input: string, instructions: string, name: string, schema: object): Promise<string> {
  const token = process.env.AI_GATEWAY_TOKEN;
  if (!token) throw new Error("AI_GATEWAY_TOKEN mangler. Bjarne trenger tilgang til AI-gatewayen.");

  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      instructions,
      input,
      text: { format: { type: "json_schema", name, strict: true, schema } },
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`AI-gatewayen svarte med ${response.status}.`);
  const text = readText(await response.json());
  if (!text) throw new Error("AI-gatewayen svarte uten tekst.");
  return text;
}
