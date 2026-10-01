import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

async function main() {
  const svgPath = path.resolve('public/og-image.svg');
  const pngPath = path.resolve('public/og-image.png');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #080c14; overflow: hidden; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `, { waitUntil: 'networkidle0' });

  await page.screenshot({ path: pngPath, type: 'png' });
  await browser.close();
  console.log(`Rendered ${pngPath} successfully (${fs.statSync(pngPath).size} bytes)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
