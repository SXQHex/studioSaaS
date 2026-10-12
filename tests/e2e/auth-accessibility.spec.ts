import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/login', '/reset-password', '/register']) {
  test(`${route} has no serious/critical axe violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(350);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    const serious = results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''));
    expect(serious, JSON.stringify(serious.map(({ id, impact, description, nodes }) => ({ id, impact, description, targets: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
  });

  test(`${route} has no horizontal overflow at mobile widths`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(width.document, JSON.stringify(width)).toBeLessThanOrEqual(width.viewport);
    expect(width.body, JSON.stringify(width)).toBeLessThanOrEqual(width.viewport);
  });
}

test('login form is keyboard reachable and exposes required fields', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByRole('textbox', { name: 'E-posta' });
  const password = page.getByLabel('Şifre');
  const submit = page.getByRole('button', { name: /Giriş yap/ });
  await expect(email).toHaveAttribute('type', 'email');
  await expect(email).toHaveAttribute('required', '');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('required', '');
  await page.keyboard.press('Tab');
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
});

test('registration requires matching passwords and never exposes role selection', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Hesap oluşturun' })).toBeVisible();
  await expect(page.getByLabel('Ad soyad')).toBeVisible();
  await expect(page.getByLabel('E-posta')).toBeVisible();
  await expect(page.getByLabel('Şifre', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Şifreyi tekrar girin')).toBeVisible();
  await expect(page.locator('select[name="role"]')).toHaveCount(0);
  await page.getByLabel('Ad soyad').fill('Test Kullanıcı');
  await page.getByLabel('E-posta').fill('test@example.invalid');
  await page.getByLabel('Şifre', { exact: true }).fill('strong-password-123');
  await page.getByLabel('Şifreyi tekrar girin').fill('different-password');
  await page.getByRole('button', { name: /Hesap oluştur/ }).click();
  await expect(page.locator('p.notice.error[role="alert"]')).toContainText('Şifreler eşleşmiyor');
});

test('login offers registration link', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Hesap oluştur' })).toHaveAttribute('href', '/register');
});
