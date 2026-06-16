require('dotenv').config({ path: '../.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = require('../backend/ai/search').SYSTEM_PROMPT; // wait, SYSTEM_PROMPT is not exported.

// I will just read the file and eval it or extract it.
const fs = require('fs');
const content = fs.readFileSync('../backend/ai/search.js', 'utf8');

const modelRegex = /const MODEL = '(.*?)'/;
const modelName = content.match(modelRegex)[1];

const maxTokensRegex = /const MAX_TOKENS = (\d+)/;
const maxTokens = parseInt(content.match(maxTokensRegex)[1], 10);

const schemaRegex = /const RESPONSE_SCHEMA = ([\s\S]*?);\n\n\/\* ── ROUTE/;
const schemaStr = content.match(schemaRegex)[1];
const RESPONSE_SCHEMA = eval('(' + schemaStr + ')');

const promptRegex = /const SYSTEM_PROMPT = `([\s\S]*?)`;/;
const systemPrompt = content.match(promptRegex)[1];

async function run() {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    }
  });

  const chat = model.startChat({ history: [] });
  const userContent = `System prompt context:\n(Eorzea Time context)\n(Shopping context)\nUser query: I need to level Alchemy and want to make something around level 81. Which recipe is the cheapest to craft right now based on live market board prices?`;
  
  console.log("Sending initial query...");
  let result = await chat.sendMessage([{ text: userContent }]);
  let response = await result.response;
  console.log("Finish Reason:", response.candidates[0].finishReason);
  console.log("Response text:", response.text().substring(0, 500) + "...");
  
  const tempAnswer = JSON.parse(response.text().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
  if (tempAnswer.needs_prices_for && tempAnswer.needs_prices_for.length > 0) {
    console.log("Needs prices for:", tempAnswer.needs_prices_for);
    const priceContext = `LIVE MARKET BOARD PRICES (Crystal Data Center):\nItem 36195: 100g NQ, 200g HQ\nItem 36196: 50g NQ, 80g HQ\nNow complete your analysis.`;
    console.log("Sending prices...");
    result = await chat.sendMessage([{ text: priceContext }]);
    response = await result.response;
    console.log("Final Finish Reason:", response.candidates[0].finishReason);
    console.log("Final Response text length:", response.text().length);
    console.log("Final Response text end:", response.text().substring(response.text().length - 100));
  }
}

run().catch(console.error);
