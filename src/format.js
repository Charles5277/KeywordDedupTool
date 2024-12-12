import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 讀取 CSV 檔案
const originContent = readFileSync('src/input/origin.txt', 'utf-8');

// 解析 CSV 內容
const rows = originContent
  .split('\n')
  .filter((row) => row.trim()) // 移除空行
  .map((row) => row.split('\t')); // 以 tab 分隔

// 移除標題列並重新格式化資料
const formattedRows = rows.slice(1).map((row) => {
  return `${row[1]}, ${row[3]}`; // 只取 keyword 和 total link strength
});

// 加入標題列
const outputContent = ['keyword, total link strength', ...formattedRows].join(
  '\n'
);

// 寫入新檔案
writeFileSync('src/input/input.csv', outputContent, 'utf-8');

console.log('檔案轉換完成！');
