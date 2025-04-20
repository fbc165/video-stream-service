require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const app = express();
const port = 8000;

const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT),
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION,
  s3ForcePathStyle: true,
});

app.get('/video/:filename', async (req, res) => {
  const videoKey = req.params.filename;
  const range = req.headers.range;
  const bucket = process.env.DO_SPACES_BUCKET

  if (!range) {
    try {
      const head = await s3.headObject({ Bucket: bucket, Key: videoKey }).promise();

      res.writeHead(200, {
        "Content-Length": head.ContentLength,
        "Content-Type": "video/mp4",
      });

      const stream = s3.getObject({ Bucket: bucket, Key: videoKey }).createReadStream();
      stream.pipe(res);
    } catch (err) {
      res.sendStatus(404);
    }
    return;
  }

  try {
    const headData = await s3.headObject({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: videoKey
    }).promise();

    const fileSize = headData.ContentLength;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });

    const stream = s3.getObject({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: videoKey,
      Range: `bytes=${start}-${end}`
    }).createReadStream();

    stream.on('error', (err) => {
      console.error('Erro no stream:', err);
      res.sendStatus(500);
    });

    stream.pipe(res);

  } catch (err) {
    res.status(500).send("Erro ao buscar vídeo");
  }
});

app.listen(port, () => {
  console.log(`Servidor de vídeo rodando em http://localhost:${port}`);
});
