const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;  
const crypto = require('crypto'); 
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const uploadSessions = {};

// 此函式用於檢查資料包在運送過程中是否有被更動或缺損
const calculateHash = data => crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');

// 1. POST /api/upload/sessions
app.post('/api/upload/sessions', async (req, res) => {
  const { totalRecord } = req.body;
  const sessionId = uuidv4();

  // 依據每一個sessionId，記錄他的totalRecord、存放的資料陣列、以及預期收到幾包資料（檢查表）
  uploadSessions[sessionId] = { totalRecord, batches: [], expectedSeqNums: new Set() };

  // 預設前提：前端每次傳一包資料都是以一萬筆為單位，只有最後一次可能不足一萬筆
  const batchSize = 10000; 

  // 舉例：若totalRecord = 33000, 則 expectedSeqNums = [0, 1, 2, 3]
  const expectedSeqNums = Array.from({ length: Math.ceil(totalRecord / batchSize) }, (_, i) => i);
  uploadSessions[sessionId].expectedSeqNums = new Set(expectedSeqNums);

  res.json({ sessionId });
});

// 2. POST /api/upload/sessions/:sessionId
app.post('/api/upload/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { seqNum, data } = req.body;
 
  if (!uploadSessions[sessionId]) {
     return res.status(404).json({ message: 'Upload session not found' });
  }
 
  if (!uploadSessions[sessionId].expectedSeqNums.has(seqNum)) {
     return res.status(400).json({ message: 'Unexpected sequence number' });
  }
 
  uploadSessions[sessionId].expectedSeqNums.delete(seqNum);
 
  const dataWithSeqNum = { seqNum, data, hash: calculateHash(data) };
  uploadSessions[sessionId].batches.push(dataWithSeqNum);
 
  const dirPath = path.join(__dirname, `upload-data/`);
  const filePath = path.join(dirPath, `${sessionId}_batch${seqNum}`);
   
  // 確保寫入檔案之前，已經開好upload-data資料夾
  try {
     await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
     console.error(`Failed to create directory: ${err}`);
  }
 // 寫入檔案
  try {
     await fs.writeFile(filePath, JSON.stringify(data)); 
  } catch (err) {
     console.error(`Failed to write file: ${err}`);
  }
 
  res.sendStatus(204);
 });
 
  
// 3. POST /api/upload/sessions/:sessionId/finish
app.post('/api/upload/sessions/:sessionId/finish', async (req, res) => {
  const { sessionId } = req.params;

  if (!uploadSessions[sessionId]) {
    return res.status(404).json({ message: 'Upload session not found' });
  }

  async function checkRemainingSeqNums(seqNums) {
    const dirPath = path.join(__dirname, `upload-data/`);
    // 若確定expectedSeqNum檢查表都清空了，意即所有資料包都已收到
    if (seqNums.size === 0) {
      const finalFilePath = path.join(dirPath, `${sessionId}_final`);

      const mergedData = [];
      const { batches } = uploadSessions[sessionId]

      // 確保資料包是依序進行整合的
      batches.sort((a, b) => a.seqNum - b.seqNum);

      for (let i = 0; i < batches.length; i++) {
        const batchData = batches[i].data; // 最後收到的資料，再丟進md5 hash一次做比對
        const batchHash = batches[i].hash; // 整合前的資料

        // 檢查資料包在運送過程中是否有被更動或缺損
        if (batchHash && batchHash !== calculateHash(batchData)) {
          return res.status(400).json({ message: 'Data integrity check failed' });
        }

        mergedData.push(...batchData);
      }
      // 寫入檔案
      try {
        await fs.writeFile(finalFilePath, JSON.stringify(mergedData));
      } catch (err) {
        console.error(`Failed to write file: ${err}`);
      }
      const validationResult =
        mergedData.length === uploadSessions[sessionId].totalRecord ? 'Success' : 'Failed';

      delete uploadSessions[sessionId];

      res.json({ sessionId, validationResult });
    } else {
      // 若仍有資料包沒收到，回傳前端缺少的資料包
      const missingSeqNums = Array.from(seqNums);
      res.status(400).json({
        message: `Missing sequence numbers: ${missingSeqNums}`,
      });
    }
  }

  await checkRemainingSeqNums(uploadSessions[sessionId].expectedSeqNums);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});