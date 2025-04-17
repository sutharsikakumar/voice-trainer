import OpenAI from 'openai';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateTongueTwister(): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant specialized in creating tongue twisters."
        },
        {
          role: "user",
          content: "Generate a fun, challenging tongue twister that is 1-2 sentences long. Make it creative, catchy, and difficult to say quickly. Only respond with the tongue twister itself, no additional text."
        }
      ],
      max_tokens: 100,
      temperature: 0.8,
    });

    return response.choices[0].message.content?.trim() || "How much wood would a woodchuck chuck if a woodchuck could chuck wood?";
  } catch (error) {
    console.error("Error generating tongue twister:", error);
    return "How much wood would a woodchuck chuck if a woodchuck could chuck wood?";
  }
}