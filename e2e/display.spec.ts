import { test, expect } from '@playwright/test';

test.describe('Display Page — Audio overlay, idle state, connection badge', () => {
  test('audio overlay visible on fresh load and disappears on click', async ({ page }) => {
    // Navigate to display page
    await page.goto('/display?room=MAIN');

    // Audio unlock overlay should be visible
    const audioOverlay = page.getByTestId('audio-unlock-overlay');
    await expect(audioOverlay).toBeVisible({ timeout: 5000 });

    // Click overlay to dismiss it
    await audioOverlay.click();

    // Overlay should disappear
    await expect(audioOverlay).not.toBeVisible({ timeout: 2000 });
  });

  test('display shows "--:--" after RESET from admin', async ({ page: displayPage, context }) => {
    // Open admin in a separate tab/context
    const adminPage = await context.newPage();
    await adminPage.goto('/admin');

    // PIN entry on admin
    const pinInput = adminPage.getByTestId('pin-input');
    const pinSubmit = adminPage.getByTestId('pin-submit');

    await expect(pinInput).toBeVisible();
    await pinInput.fill('1234');
    await pinSubmit.click();

    // Wait for PIN gate to clear
    await expect(adminPage.getByTestId('btn-start')).toBeVisible({ timeout: 5000 });

    // Navigate display page to MAIN room
    await displayPage.goto('/display?room=MAIN');

    // Dismiss audio overlay
    const audioOverlay = displayPage.getByTestId('audio-unlock-overlay');
    await expect(audioOverlay).toBeVisible({ timeout: 5000 });
    await audioOverlay.click();

    // START session from admin
    const startBtn = adminPage.getByTestId('btn-start');
    await startBtn.click();

    // Wait for display to show active countdown (not "--:--")
    const countdownDisplay = displayPage.getByTestId('countdown-display');
    await expect(countdownDisplay).toBeVisible({ timeout: 5000 });

    // Wait a moment for UI to settle
    await displayPage.waitForTimeout(500);

    // Now RESET from admin
    const resetBtn = adminPage.getByTestId('btn-reset');
    await resetBtn.click();

    // Confirm RESET
    const confirmYesBtn = adminPage.getByTestId('btn-confirm-yes');
    await expect(confirmYesBtn).toBeVisible();
    await confirmYesBtn.click();

    // Display should show "--:--" within 2 seconds
    let resetText = await countdownDisplay.textContent();
    const maxAttempts = 20; // 2 seconds at 100ms intervals
    let attempts = 0;

    while (!resetText?.includes('--:--') && attempts < maxAttempts) {
      await displayPage.waitForTimeout(100);
      resetText = await countdownDisplay.textContent();
      attempts++;
    }

    expect(resetText).toContain('--:--');

    await adminPage.close();
  });

  test('connection status shows "Connected" within 5s of page load', async ({ page }) => {
    // Navigate to display page
    await page.goto('/display?room=MAIN');

    // Dismiss audio overlay first
    const audioOverlay = page.getByTestId('audio-unlock-overlay');
    await expect(audioOverlay).toBeVisible({ timeout: 5000 });
    await audioOverlay.click();

    // Connection status badge should appear and show "Connected"
    const connectionStatus = page.getByTestId('connection-status');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });

    const statusText = await connectionStatus.textContent();
    expect(statusText).toContain('Connected');
  });
});
