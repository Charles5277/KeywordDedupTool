關鍵字去重工具

## 環境需求

- Node.js 18+
- pnpm

> 若沒有 pnpm 則先安裝 `npm install -g pnpm`

## 安裝方式

```bash
pnpm install
```

## 設定 GEMINI API

1. [取得 API KEY](https://aistudio.google.com/apikey)
2. 將 .env.sample 複製並改為 .env
3. 填入 API KEY

```
GEMINI_API=Xxoo12345678
```

## 準備檔案

- 在 src/input 中放來源檔案 origin.txt

例如:

```
id	keyword	occurrences	total link strength
7	1/f noise	10	34
16	1st-principles	24	126
18	1st-principles calculations	5	25
23	2-dimensional materials	9	48
28	2-photon absorption	12	39
```

## 執行分析

- 初次啟動需先執行

```
docker compose exec app pnpm start
```

- 之後只需執行

```
docker-compose exec app pnpm start
```

## 取得結果

- 結果會輸出到 src/output 資料夾中，產生 output.csv
