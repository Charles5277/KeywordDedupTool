import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile } from 'fs/promises';

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API;

const genAI = new GoogleGenerativeAI(API_KEY);
const fileManager = new GoogleAIFileManager(API_KEY);

async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

async function waitForFilesActive(files) {
  console.log('Waiting for file processing...');
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === 'PROCESSING') {
      process.stdout.write('.');
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      file = await fileManager.getFile(name);
    }
    if (file.state !== 'ACTIVE') {
      throw Error(`File ${file.name} failed to process`);
    }
  }
  console.log('...all files ready\n');
}

async function run() {
  const files = [await uploadToGemini('src/input/input.csv', 'text/csv')];

  await waitForFilesActive(files);

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
  });

  const chatSession = model.startChat({
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
    history: [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              mimeType: files[0].mimeType,
              fileUri: files[0].uri,
            },
          },
          {
            text: '我有一個 csv 檔案，包含 keyword 跟 total link strength 值。請針對相似的 keyword 進行篩選並合併，保留具有較大 strength 值的項目。具體來說：\n\n1. 請處理名詞複數、時態差異、名詞縮寫、相似詞、僅有 dash 或 underscore 等視覺差異的情況。例如：\n   - `beta-ga2o3 single-crystals` 與 `beta-ga2o3` 是相同的，且 `beta-ga2o3` 的 strength 值較大，因此應該僅保留 `beta-ga2o3`。\n   - `si(111)` 和 `si` 都是 `silicon` 的縮寫，應該僅保留 `silicon`。\n   - `systems` 和 `system` 只差一個複數 `s`，應該僅保留 `system`。\n   - `carbon emission` 和 `carbon emissions` 是相同的，應保留一個。\n   - `climate change` 和 `climate change mitigation` 是相同的概念，應該保留 `climate change`。\n   - `cooling system` 和 `cooling systems` 也是相同的概念，應該保留 `cooling system`。\n\n2. 若有以下情況，請合併並保留更強的項目：\n   - `zero-energy building`、`zero-energy buildings`、`zero energy building`、`zero energy house` 等都屬於同一概念，應選擇 strength 最大的項目保留。\n\n3. 保持結果中的關鍵字是唯一的，並且選擇 `total link strength` 值最大的那一項。例如：\n   - `air-quality` 與 `air quality` 應合併為 `air-quality`，保留 strength 大的項目。\n   - `algorithm` 和 `algorithms` 應合併為 `algorithm`。\n\n最後，請輸出處理後的資料，並以 array of object 格式呈現，每個物件包含 `k`（關鍵字）與 `t`（strength）。以下是範例格式：\n\n[\n  {\n    "k": "air-quality",\n    "t": 63\n  },\n  {\n    "k": "airtightness",\n    "t": 43\n  },\n  {\n    "k": "algorithm",\n    "t": 223\n  },\n  {\n    "k": "cities",\n    "t": 139\n  },\n  {\n    "k": "city",\n    "t": 191\n  }\n]',
          },
        ],
      },
    ],
  });

  const result = await chatSession.sendMessage('請開始分析');
  return result.response.text();
}

// - 將 json 解析成 csv
function parseJsonToCsv(jsonData) {
  console.log(jsonData);

  const keywords = JSON.parse(jsonData);
  const csvHeader = 'keyword, total link strength\n';
  const csvRows = keywords.map((item) => `${item.k}, ${item.t}`).join('\n');
  return csvHeader + csvRows;
}

// - 儲存 csv 檔案
async function saveCsvFile(csvContent) {
  await writeFile('src/output/output.csv', csvContent);
}

// 修改主程式執行部分
run()
  .then(async (jsonResult) => {
    const csvContent = parseJsonToCsv(jsonResult);
    await saveCsvFile(csvContent);
    console.log('CSV file has been saved successfully!');
  })
  .catch(console.error);
