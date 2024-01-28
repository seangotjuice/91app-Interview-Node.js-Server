const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;  // 使用 fs.promises 替代 fs
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const uploadSessions = {};

// 1. POST /api/upload/sessions
app.post('/api/upload/sessions', async (req, res) => {
  const { totalRecord } = req.body;
  const sessionId = uuidv4();

  uploadSessions[sessionId] = { totalRecord, batches: [], expectedSeqNums: new Set() };

  const batchSize = 10000;
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

  const dataWithSeqNum = { seqNum, data };
  uploadSessions[sessionId].batches.push(dataWithSeqNum);

  res.sendStatus(204);
});

// 3. POST /api/upload/sessions/:sessionId/finish
app.post('/api/upload/sessions/:sessionId/finish', async (req, res) => {
  const { sessionId } = req.params;

  if (!uploadSessions[sessionId]) {
    return res.status(404).json({ message: 'Upload session not found' });
  }

  async function checkRemainingSeqNums(seqNums) {
    if (seqNums.size === 0) {
      const finalFilePath = path.join(__dirname, `upload-data/${sessionId}_final`);
      const mergedData = [];
      const { batches } = uploadSessions[sessionId]

      batches.sort((a, b) => a.seqNum - b.seqNum);
      
      for (let i = 0; i < batches.length; i++) {
        const batchData = batches[i].data;
        mergedData.push(...batchData);
      }

      await fs.writeFile(finalFilePath, JSON.stringify(mergedData));

      const validationResult =
        mergedData.length === uploadSessions[sessionId].totalRecord ? 'Success' : 'Failed';

      delete uploadSessions[sessionId];

      res.json({ sessionId, validationResult });
    } else {
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