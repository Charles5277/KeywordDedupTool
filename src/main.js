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
            text: '想要針對相似的keyword進行篩選\n有些相同意義的keyword會重複出現，例如\nbeta-ga2o3 single-crystals\n跟\nbeta-ga2o3\n是相同的，且beta-ga2o3的strength值較大，因此應該僅保留 beta-ga2o3 而略過\nbeta-ga2o3 single-crystals\n\n\n再舉一些例子\nsi(111) 跟 si 都是 silicon 的縮寫\n比對 strength值後應該僅保留silicon \n\nsystems 跟 system 只差在是否有 s，比對 strength 後應該僅保留 system\n\ncarbon emission 跟 carbon emissions 是一樣的\nclimate change 跟 climate change mitigation 是一樣的\ncities 跟 city 是一樣的\ncooling system 跟 cooling systems 是一樣的\ndecarbonisation 跟 decarbonization 是一樣的\ndemand side management 跟 demand-side \nefficiency 跟 efficient 是一樣的\nenergy saving 跟 energy savings 是一樣的\nenvironmental impact 跟 environmental impacts 是一樣的\nfacade 跟 facades 是一樣的\ndoherty amplifiler 跟 doherty power-amplifiler是一樣的\n\nzero-energy building 跟 zero-energy buildings 跟\nzero energy building 跟 zero energy building (zeb) 跟\nzero energy buildings 跟 zero energy house 是一樣的，應該僅保留這其中值最大的那一項，包含但不僅限於上面的例子。\n\n簡單來說，你必須找出名詞複數、時態差異、名詞縮寫、相似詞、僅差異 dash 或 underscore 等情況。\n\n這類情況都必須比較他們的 total link strength 值，只留下較大的那項\n最後只留下沒有重複意義的資料紀錄\n例如\nkeyword, total link strength\nadaptation, 63\nadoption, 105\nair, 103\nair-conditioning system, 84\nair-quality, 63\nairtightness, 43\nalgorithm, 223\nalgorithms, 104\n\n\n最後結果給我 array of object 的格式，例如\n[\n  {\n    "k": "adaptation",\n    "t": 63\n  },\n  {\n    "k": "adoption",\n    "t": 105\n  },\n  {\n    "k": "air",\n    "t": 103\n  },\n  {\n    "k": "air-conditioning system",\n    "t": 84\n  },\n  {\n    "k": "air-quality",\n    "t": 63\n  },\n  {\n    "k": "airtightness",\n    "t": 43\n  },\n  {\n    "k": "algorithm",\n    "t": 223\n  },\n]\n',
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
