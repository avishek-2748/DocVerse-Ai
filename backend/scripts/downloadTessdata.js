#!/usr/bin/env node
/**
 * Downloads the Tesseract English language data file (eng.traineddata)
 * from GitHub to the backend/tessdata directory.
 * Run once: node backend/scripts/downloadTessdata.js
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESSDATA_DIR = path.join(__dirname, '..', 'tessdata');
const TESSDATA_FILE = path.join(TESSDATA_DIR, 'eng.traineddata');
const TESSDATA_URL = 'https://github.com/naptha/tessdata/raw/refs/heads/gh-pages/4.0.0/eng.traineddata.gz';

async function download() {
  if (fs.existsSync(TESSDATA_FILE)) {
    console.log(`✅ eng.traineddata already exists at: ${TESSDATA_FILE}`);
    return;
  }

  fs.mkdirSync(TESSDATA_DIR, { recursive: true });

  console.log(`Downloading eng.traineddata from GitHub...`);
  console.log(`URL: ${TESSDATA_URL}`);
  console.log(`Destination: ${TESSDATA_FILE}\n`);

  const { createGunzip } = await import('zlib');
  const { pipeline } = await import('stream/promises');

  const gzFile = TESSDATA_FILE + '.gz';
  const fileStream = fs.createWriteStream(gzFile);

  await new Promise((resolve, reject) => {
    https.get(TESSDATA_URL, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirect
        https.get(res.headers.location, (res2) => {
          res2.pipe(fileStream);
          fileStream.on('finish', () => fileStream.close(resolve));
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(resolve));
      res.on('error', reject);
    }).on('error', reject);
  });

  console.log(`Decompressing...`);
  await pipeline(
    fs.createReadStream(gzFile),
    createGunzip(),
    fs.createWriteStream(TESSDATA_FILE)
  );
  
  fs.unlinkSync(gzFile);
  const stat = fs.statSync(TESSDATA_FILE);
  console.log(`✅ Done! eng.traineddata saved (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
}

download().catch(err => {
  console.error('❌ Download failed:', err.message);
  process.exit(1);
});
