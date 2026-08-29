const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const [,, input, output, wArg, hArg] = process.argv;
  const w = parseInt(wArg || '1500', 10);
  const h = parseInt(hArg || '1200', 10);
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.goto('file://' + path.resolve(input), { waitUntil: 'networkidle0' });
  await page.screenshot({ path: output, clip: { x: 0, y: 0, width: w, height: h } });
  await browser.close();
  console.log('Wrote', output);
})();
