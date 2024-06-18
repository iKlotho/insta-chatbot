import OpenAI from "openai";
import { downloadImageToBase64, logger } from "./utils";
import {
  OPENAI_MAX_TOKENS,
  OPENAI_MODEL,
  SYSTEM_PROMPT,
  USER_PROMPT,
} from "./constants";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function classifyImage(url: string): Promise<string | null> {
  try {
    const base64Image = await downloadImageToBase64(url);

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
      max_tokens: OPENAI_MAX_TOKENS,
      model: OPENAI_MODEL,
    };

    const chatCompletion: OpenAI.Chat.ChatCompletion =
      await openai.chat.completions.create(params);

    return chatCompletion?.choices?.[0]?.message.content || null;
  } catch (error: any) {
    logger.error(`Error classifying image: ${error.message}`);
    return null;
  }
}
