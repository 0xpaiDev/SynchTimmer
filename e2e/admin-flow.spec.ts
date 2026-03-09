import { test, expect } from '@playwright/test';

test.describe('Admin Flow — PIN, START, PAUSE, RESUME, RESET', () => {
  test('complete flow: PIN entry → START → PAUSE (frozen) → RESUME (counting) → RESET (cancel) → RESET (confirm)', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin');

    // PIN entry
    const pinInput = page.getByTestId('pin-input');
    const pinSubmit = page.getByTestId('pin-submit');

    await expect(pinInput).toBeVisible();
    await pinInput.fill('1234');
    await pinSubmit.click();

    // Wait for PIN gate to clear and show session controls
    await expect(page.getByTestId('btn-start')).toBeVisible({ timeout: 5000 });

    // START session with 30s climbing, 10s preparation
    // Click START button
    const startBtn = page.getByTestId('btn-start');
    await startBtn.click();

    // Wait for clock to appear and start ticking
    const clockDisplay = page.getByTestId('clock-display');
    await expect(clockDisplay).toBeVisible({ timeout: 5000 });

    // Read initial clock value
    let clockText1 = await clockDisplay.textContent();
    expect(clockText1).toBeTruthy();

    // Wait a second and read clock again to confirm it's ticking
    await page.waitForTimeout(1000);
    let clockText2 = await clockDisplay.textContent();
    expect(clockText2).not.toBe(clockText1);

    // PAUSE button should now be visible
    const pauseBtn = page.getByTestId('btn-pause');
    await expect(pauseBtn).toBeVisible();

    // Click PAUSE
    await pauseBtn.click();

    // Wait for pause state to propagate
    await page.waitForTimeout(500);

    // Assert clock is frozen — read it twice 1s apart and verify equal
    const pausedClock1 = await clockDisplay.textContent();
    await page.waitForTimeout(1000);
    const pausedClock2 = await clockDisplay.textContent();

    expect(pausedClock1).toBe(pausedClock2);

    // RESUME button should be visible
    const resumeBtn = page.getByTestId('btn-resume');
    await expect(resumeBtn).toBeVisible();

    // Click RESUME
    await resumeBtn.click();

    // Wait for resume to propagate
    await page.waitForTimeout(500);

    // Assert clock is counting again
    const resumedClock1 = await clockDisplay.textContent();
    await page.waitForTimeout(1000);
    const resumedClock2 = await clockDisplay.textContent();

    expect(resumedClock1).not.toBe(resumedClock2);

    // RESET button should be visible
    const resetBtn = page.getByTestId('btn-reset');
    await expect(resetBtn).toBeVisible();

    // Click RESET (first time) — should show confirmation
    await resetBtn.click();

    // Confirmation dialog should appear with Yes and Cancel buttons
    const confirmYesBtn = page.getByTestId('btn-confirm-yes');
    const confirmCancelBtn = page.getByTestId('btn-confirm-cancel');

    await expect(confirmYesBtn).toBeVisible();
    await expect(confirmCancelBtn).toBeVisible();

    // Click Cancel — should dismiss and clock should still be running
    await confirmCancelBtn.click();

    // Clock should still be visible and counting
    await expect(clockDisplay).toBeVisible();
    const stillRunningClock1 = await clockDisplay.textContent();
    await page.waitForTimeout(1000);
    const stillRunningClock2 = await clockDisplay.textContent();

    expect(stillRunningClock1).not.toBe(stillRunningClock2);

    // Click RESET again
    await resetBtn.click();

    // Confirmation dialog again
    await expect(confirmYesBtn).toBeVisible();

    // Click Yes to confirm RESET
    await confirmYesBtn.click();

    // Wait for reset to propagate
    await page.waitForTimeout(500);

    // Clock should return to idle state "--:--"
    const idleClock = await clockDisplay.textContent();
    expect(idleClock).toContain('--:--');

    // START button should be visible again
    await expect(startBtn).toBeVisible();
  });
});
