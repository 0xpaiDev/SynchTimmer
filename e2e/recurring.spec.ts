import { test, expect } from '@playwright/test';

test.describe('Recurring Mode — Auto-restart on climb end', () => {
  test('enable recurring, 5s climb, START → wait 8s → assert NOT "--:--" (auto-restarted)', async ({ page }) => {
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

    // Enable recurring mode checkbox
    // Note: The exact selector depends on the admin UI implementation
    // Looking for a recurring toggle/checkbox
    const recurringCheckbox = page.getByLabel(/recurring/i);

    // If the checkbox exists, enable it
    const isChecked = await recurringCheckbox.isChecked();
    if (!isChecked) {
      await recurringCheckbox.click();
    }

    // Set climbing seconds to 5
    // Look for climbing duration input
    const climbingInput = page.locator('input[type="number"]').first(); // First number input is usually climbing seconds

    // Clear and set to 5
    await climbingInput.clear();
    await climbingInput.fill('5');

    // START session
    const startBtn = page.getByTestId('btn-start');
    await startBtn.click();

    // Wait for clock to appear
    const clockDisplay = page.getByTestId('clock-display');
    await expect(clockDisplay).toBeVisible({ timeout: 5000 });

    // Get countdown display to monitor
    const countdownDisplay = page.getByTestId('countdown-display');

    // Wait 8 seconds
    // During this time:
    // - First 5s: climbing phase (should show countdown)
    // - After 5s: should auto-restart if recurring is enabled
    await page.waitForTimeout(8000);

    // After 8 seconds with 5s climb + recurring, we should NOT see "--:--"
    // (it should have auto-restarted into a new round)
    const displayText = await countdownDisplay.textContent();

    // The display should show an active countdown, not idle "--:--"
    expect(displayText).not.toContain('--:--');

    // Additionally verify the clock is still running
    const clock1 = await clockDisplay.textContent();
    await page.waitForTimeout(500);
    const clock2 = await clockDisplay.textContent();

    // Clock should be different (still counting)
    expect(clock1).not.toBe(clock2);
  });

  test('recurring mode enabled state persists in UI', async ({ page }) => {
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

    // Check if recurring checkbox exists and toggle it
    const recurringCheckbox = page.getByLabel(/recurring/i);

    // Get initial state
    const initialState = await recurringCheckbox.isChecked();

    // Toggle it
    await recurringCheckbox.click();

    // Wait a moment
    await page.waitForTimeout(200);

    // Verify state changed
    const newState = await recurringCheckbox.isChecked();
    expect(newState).toBe(!initialState);

    // Toggle back
    await recurringCheckbox.click();

    await page.waitForTimeout(200);

    // Verify it's back to original state
    const finalState = await recurringCheckbox.isChecked();
    expect(finalState).toBe(initialState);
  });
});
