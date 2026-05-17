const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const html = fs.readFileSync('powerops-v1-slide.html', 'utf8');
  let svg = fs.readFileSync('/tmp/v1.svg', 'utf8');
  svg = svg.replace(/style="max-width:[^"]*"/, 'style="background-color: transparent;"');
  svg = svg.replace(/<svg([^>]*?)width="[^"]*"/, '<svg$1');
  const merged = html.replace('<div class="chart-wrap" id="chart"></div>',
    '<div class="chart-wrap" id="chart">' + svg + '</div>');

  const tmpPath = path.resolve('.tmp-v1.html');
  fs.writeFileSync(tmpPath, merged);

  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto('file://' + tmpPath, { waitUntil: 'networkidle0' });
  await page.screenshot({
    path: 'powerops-shift-report-v1-slide-16x9.png',
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });
  await browser.close();
  fs.unlinkSync(tmpPath);
  console.log('Wrote powerops-shift-report-v1-slide-16x9.png');
})();
