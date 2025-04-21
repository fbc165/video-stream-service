require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;
const port = 3000;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} está rodando com ${numCPUs} CPUs`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Se um worker morrer, cria outro
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} morreu. Criando outro...`);
    cluster.fork();
  });

} else {
  const app = express();

  // Cliente S3 configurado
  const s3 = new AWS.S3({
    endpoint: new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT),
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION,
    s3ForcePathStyle: true,
    httpOptions: { timeout: 300000 }
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

      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
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
    console.log(`Worker ${process.pid} escutando em http://localhost:${port}`);
  });
}
