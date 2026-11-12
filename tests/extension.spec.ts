const { chromium, expect } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, '../browser-extension');
  const userDataDir = '/tmp/test-user-data-dir';
  
  // Clean up previous user data
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  // Get extension ID
  let extensionId;
  const backgroundPage = await browserContext.backgroundPages()[0];
  if (!backgroundPage) {
    console.error('Background page not found.');
    await browserContext.close();
    return;
  }
  
  const worker = backgroundPage.worker();
  extensionId = worker.url().split('/')[2];
  console.log(`Extension ID: ${extensionId}`);

  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

  // Verify UI renders
  await expect(page.locator('#connect-btn')).toBeVisible();
  await expect(page.locator('#status-label')).toBeVisible();

  // Console error check
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Console error: ${msg.text()}`);
    }
  });

  // Proceed with interactions if needed, or close
  await browserContext.close();
})();
