declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

type ScanStatus = "confirmed" | "mismatch" | "uncertain" | "unavailable";

type ScanResponse = {
  detectedCount: number;
  confidence: number;
  claimedCount: number;
  status: ScanStatus;
  explanation: string;
  boxes: ScanBox[];
};

type ScanBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json(unavailable("OpenAI API key is not configured.", 1), 200);
  }

  try {
    const { imageBase64, mimeType = "image/jpeg", claimedCount = 1 } = await request.json();
    const normalizedClaim = clampCount(claimedCount);

    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      return json({ error: "imageBase64 is required." }, 400);
    }

    const model = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions:
          "You count beers in user photos for a beer check-in app. Count visible beers only: cans, bottles, draft glasses, pint glasses, tasting glasses, or cups that are likely beer. Do not count signs, logos, menu items, empty packaging, water, people, or duplicate reflections. If the image is unclear, return a lower confidence.",
        temperature: 0,
        max_output_tokens: 900,
        text: {
          format: {
            type: "json_schema",
            name: "beer_photo_scan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                detectedCount: {
                  type: "integer",
                  minimum: 0,
                  maximum: 24,
                  description: "Visible beer servings, bottles, cans, glasses, or cups likely containing beer."
                },
                confidence: {
                  type: "number",
                  minimum: 0,
                  maximum: 1
                },
                explanation: {
                  type: "string"
                },
                boxes: {
                  type: "array",
                  maxItems: 24,
                  description: "Normalized bounding boxes for each counted beer, using the original image coordinate space.",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      x: {
                        type: "number",
                        minimum: 0,
                        maximum: 1,
                        description: "Left edge as a fraction of image width."
                      },
                      y: {
                        type: "number",
                        minimum: 0,
                        maximum: 1,
                        description: "Top edge as a fraction of image height."
                      },
                      width: {
                        type: "number",
                        minimum: 0,
                        maximum: 1
                      },
                      height: {
                        type: "number",
                        minimum: 0,
                        maximum: 1
                      },
                      confidence: {
                        type: "number",
                        minimum: 0,
                        maximum: 1
                      },
                      label: {
                        type: "string"
                      }
                    },
                    required: ["x", "y", "width", "height", "confidence", "label"]
                  }
                }
              },
              required: ["detectedCount", "confidence", "explanation", "boxes"]
            }
          }
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Estimate the number of beers visible in this photo. Return a count plus one normalized box for each counted beer. Be conservative when the object is blocked, empty, non-alcoholic, or ambiguous. Boxes must surround only the counted beer object, not a person's hand or the whole table."
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high"
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      return json(unavailable("Scanner provider could not inspect the photo.", normalizedClaim), 200);
    }

    const payload = await response.json();
    const parsed = parseStructuredOutput(payload);
    const detectedCount = clampCount(parsed?.detectedCount);
    const confidence = clampConfidence(parsed?.confidence);
    const boxes = normalizeBoxes(parsed?.boxes);
    const finalCount = Math.max(detectedCount, boxes.length);
    const finalConfidence = boxes.length && confidence === 0 ? averageBoxConfidence(boxes) : confidence;
    const status = statusFor(finalCount, normalizedClaim, finalConfidence);

    return json({
      detectedCount: finalCount,
      confidence: finalConfidence,
      claimedCount: normalizedClaim,
      status,
      explanation: explanationFor(status, finalCount, parsed?.explanation),
      boxes
    });
  } catch {
    return json(unavailable("Scanner could not inspect this photo.", 1), 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function unavailable(explanation: string, claimedCount: number): ScanResponse {
  return {
    detectedCount: 0,
    confidence: 0,
    claimedCount,
    status: "unavailable",
    explanation,
    boxes: []
  };
}

function statusFor(detectedCount: number, claimedCount: number, confidence: number): ScanStatus {
  if (confidence < 0.45 || detectedCount < 1) return "uncertain";
  return detectedCount === claimedCount ? "confirmed" : "mismatch";
}

function explanationFor(status: ScanStatus, detectedCount: number, modelExplanation: unknown) {
  if (typeof modelExplanation === "string" && modelExplanation.trim()) return modelExplanation.trim();
  if (status === "confirmed") return "Scanner count matches the claimed beer count.";
  if (status === "mismatch") return `Scanner sees about ${detectedCount} beer${detectedCount === 1 ? "" : "s"} in the photo.`;
  return "Scanner could not confidently count the beers in this photo.";
}

function clampCount(value: unknown) {
  const count = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1;
  return Math.max(0, Math.min(24, count));
}

function clampConfidence(value: unknown) {
  const confidence = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, confidence));
}

function parseStructuredOutput(payload: unknown) {
  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  if (typeof response.output_text === "string") return JSON.parse(response.output_text);

  const outputText = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text) => typeof text === "string");
  if (typeof outputText === "string") return JSON.parse(outputText);

  const chatContent = response.choices?.[0]?.message?.content;
  if (typeof chatContent === "string") return JSON.parse(chatContent);
  return chatContent;
}

function normalizeBoxes(value: unknown): ScanBox[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 24)
    .map((item) => {
      const box = item as Partial<ScanBox> | null;
      return {
        x: clampUnit(box?.x),
        y: clampUnit(box?.y),
        width: clampUnit(box?.width),
        height: clampUnit(box?.height),
        confidence: clampConfidence(box?.confidence),
        label: typeof box?.label === "string" && box.label.trim() ? box.label.trim() : "beer"
      };
    })
    .filter((box) => box.width > 0.02 && box.height > 0.02 && box.confidence >= 0.15);
}

function averageBoxConfidence(boxes: ScanBox[]) {
  return boxes.reduce((sum, box) => sum + box.confidence, 0) / boxes.length;
}

function clampUnit(value: unknown) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, numeric));
}
