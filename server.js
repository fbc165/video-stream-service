require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const app = express();
const port = 3000;

// Configuração corrigida do cliente S3
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT),
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION,
  s3ForcePathStyle: true,
  httpOptions: { timeout: 300000 } // Timeout de 5 minutos
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro global:', err);
  if (!res.headersSent) {
    res.status(500).send('Erro interno');
  }
});

app.get('/video/:filename', async (req, res) => {
  const videoKey = req.params.filename;
  const range = req.headers.range;
  const bucket = process.env.DO_SPACES_BUCKET;
  let headersSent = false;

  try {
    const headData = await s3.headObject({ 
      Bucket: bucket, 
      Key: videoKey 
    }).promise();

    const fileSize = headData.ContentLength;

    // Tratamento de range request corrigido
    if (!range) {
      headersSent = true;
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      });
      
      const stream = s3.getObject({ Bucket: bucket, Key: videoKey })
        .createReadStream()
        .on('error', handleStreamError);
      
      stream.pipe(res);
      setupAbortHandling(stream, res);
      return;
    }

    // Parse correto do range
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10); // Corrigido índice [0]
    const end = parts[1] 
      ? parseInt(parts[1], 10) 
      : fileSize - 1;
    const chunkSize = end - start + 1;

    headersSent = true;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });

    const stream = s3.getObject({
      Bucket: bucket,
      Key: videoKey,
      Range: `bytes=${start}-${end}`
    }).createReadStream()
      .on('error', handleStreamError);

    stream.pipe(res);
    setupAbortHandling(stream, res);

  } catch (err) {
    if (!headersSent) {
      err.statusCode === 404 
        ? res.sendStatus(404) 
        : res.sendStatus(500);
    }
  }

  // Funções auxiliares
  function handleStreamError(err) {
    console.error('Erro no stream:', err);
    if (!headersSent) {
      res.sendStatus(err.statusCode || 500);
      headersSent = true;
    }
  }

  function setupAbortHandling(stream, response) {
    response.on('close', () => {
      if (!stream.destroyed) {
        stream.destroy();
      }
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
