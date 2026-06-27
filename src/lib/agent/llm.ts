import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

function zodToTextDescription(schema: z.ZodType<any>): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const parts = [];
    for (const key of Object.keys(shape)) {
      const field = shape[key];
      let typeStr = "any";
      let desc = "";
      
      if (field instanceof z.ZodString) typeStr = "string";
      else if (field instanceof z.ZodNumber) typeStr = "number";
      else if (field instanceof z.ZodBoolean) typeStr = "boolean";
      else if (field instanceof z.ZodEnum) typeStr = `enum [${(field as z.ZodEnum<any>).options.join(", ")}]`;
      else if (field instanceof z.ZodArray) typeStr = "array of strings";
      else if (field instanceof z.ZodObject) typeStr = `object: ${zodToTextDescription(field)}`;
      
      if (field._def.description) {
        desc = ` (${field._def.description})`;
      }
      parts.push(`  "${key}": ${typeStr}${desc}`);
    }
    return `{\n${parts.join(",\n")}\n}`;
  }
  return "JSON object";
}

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3
): Promise<{ content: string; source: "gemini" | "groq" }> {
  try {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
      temperature,
    });

    const response = await model.invoke([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]);

    return { content: response.content as string, source: "gemini" };
  } catch (error: any) {
    console.warn(`[GEMINI ERROR] falling back to Groq: ${error.message || error}`);
    
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw error;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content || "";
    return { content, source: "groq" };
  }
}

export async function callLlmStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  temperature: number = 0.2
): Promise<{ data: T; source: "gemini" | "groq" }> {
  try {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
      temperature,
    });

    const structuredModel = model.withStructuredOutput(schema);
    const result = await structuredModel.invoke([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]) as T;

    return { data: result, source: "gemini" };
  } catch (error: any) {
    console.warn(`[GEMINI STRUCTURED ERROR] falling back to Groq structured: ${error.message || error}`);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw error;
    }

    const schemaDesc = zodToTextDescription(schema);
    const jsonHints = `\n\nIMPORTANT: You must return a JSON object matching this schema:\n${schemaDesc}\nDo not wrap the JSON in markdown formatting blocks (like \`\`\`json). Return ONLY the raw JSON object.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt + jsonHints },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq structured API error: ${response.status} - ${errText}`);
    }

    const resJson = await response.json();
    const content = resJson.choices[0].message.content || "";
    
    // Clean up content just in case the model returns markdown code blocks
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);
    const validated = schema.parse(parsed);
    return { data: validated, source: "groq" };
  }
}
