import OpenAI from 'openai';
import { HttpError } from './http';

let client: OpenAI | null = null;

function getClient() {
  if (client) return client;

  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(500, 'Missing OPENAI_API_KEY');
  }

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return client;
}

export async function callOpenAI(prompt: string, expectJson = true) {
  const response = await getClient().responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.2',
    input: prompt,
  });

  const text = response.output_text.trim();
  if (!expectJson) {
    return text;
  }

  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
}
