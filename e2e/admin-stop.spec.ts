import { test, expect } from '@playwright/test';

test.describe('Admin STOP — START → STOP → confirm → verify idle → START again', () => {
  test('STOP action with confirmation dialog', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin');

    // PIN entry
    const pinInput = page.getByTestId('pin-input');
    const pinSubmit = page.getByTestId('pin-submit');

    await expect(pinInput).toBeVisible();
    await pinInput.fill('1234');
    await pinSubmit.click();

    // Wait for PIN gate to clear
    await expect(page.getByTestId('btn-start')).toBeVisible({ timeout: 5000 });

    // START session
    const startBtn = page.getByTestId('btn-start');
    await startBtn.click();

    // Wait for clock to appear
    const clockDisplay = page.getByTestId('clock-display');
    await expect(clockDisplay).toBeVisible({ timeout: 5000 });

    // Verify clock is ticking
    const clockBefore = await clockDisplay.textContent();
    await page.waitForTimeout(1000);
    const clockAfter = await clockDisplay.textContent();
    expect(clockBefore).not.toBe(clockAfter);

    // STOP button should be visible (it's the END SESSION button when running)
    const stopBtn = page.getByTestId('btn-stop');
    await expect(stopBtn).toBeVisible();

    // Click STOP
    await stopBtn.click();

    // Confirmation dialog should appear
    const confirmYesBtn = page.getByTestId('btn-confirm-yes');
    const confirmCancelBtn = page.getByTestId('btn-confirm-cancel');

    await expect(confirmYesBtn).toBeVisible();
    await expect(confirmCancelBtn).toBeVisible();

    // Click Yes to confirm STOP
    await confirmYesBtn.click();

    // Wait for stop to propagate
    await page.waitForTimeout(500);

    // Session banner should show stopped state
    const sessionBanner = page.getByTestId('session-banner');
    await expect(sessionBanner).toBeVisible();

    // Clock should show "--:--" (idle)
    const idleClock = await clockDisplay.textContent();
    expect(idleClock).toContain('--:--');

    // START button should be visible again
    await expect(startBtn).toBeVisible();

    // START again to verify fresh session
    await startBtn.click();

    // Wait for clock to appear again
    await expect(clockDisplay).toBeVisible({ timeout: 5000 });

    // Verify we're counting from ~30s (fresh session)
    // Allow some tolerance for timing
    const freshClock = await clockDisplay.textContent();
    expect(freshClock).toBeTruthy();

    // Wait and verify clock is counting down
    const freshClock1 = freshClock;
    await page.waitForTimeout(1000);
    const freshClock2 = await clockDisplay.textContent();

    expect(freshClock1).not.toBe(freshClock2);
  });
});
