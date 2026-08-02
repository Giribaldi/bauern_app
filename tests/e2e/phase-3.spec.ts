import { expect, test } from '@playwright/test'

test('storefront: recherche, ferme, panier, checkout et suivi invité', async ({ page }) => {
  await page.route('https://checkout.stripe.test/**', (route) => route.abort())
  await page.goto('http://localhost:3001')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.getByText('Ferme des Prés')).toBeVisible()
  await page.getByRole('button', { name: 'Voir les produits' }).first().click()
  await expect(page.getByRole('heading', { name: 'Produits disponibles' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter au panier' }).first().click()
  await expect(page.getByRole('heading', { name: 'Panier' })).toBeVisible()
  const checkoutResponse = page.waitForResponse(
    (response) => response.url().endsWith('/v1/checkout') && response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Payer avec Stripe' }).click()
  const response = await checkoutResponse
  expect(response.ok()).toBe(true)
  await page.goto('http://localhost:3001')
  await expect(page.getByLabel('Jeton de suivi')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Consulter' }).click()
  await expect(page.getByText(/pending_payment/)).toBeVisible()
})

test('admin: connexion, ferme isolée, offre, stock et commandes', async ({ page }) => {
  await page.goto('http://localhost:3002')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveValue('20000000-0000-4000-8000-000000000001')
  const listingTitle = `Offre E2E ${Date.now()}`
  await page.getByPlaceholder('Nom de l’offre').fill(listingTitle)
  await page.getByPlaceholder('UUID produit catalogue').fill('40000000-0000-4000-8000-000000000001')
  await page.getByPlaceholder('Prix en centimes').fill('375')
  await page.getByRole('button', { name: 'Publier' }).click()
  await expect(page.getByText(listingTitle, { exact: true })).toBeVisible()
  const stockResponse = page.waitForResponse((response) =>
    response.url().includes('/inventory/movements')
  )
  await page.getByRole('button', { name: '+ 1' }).first().click()
  expect((await stockResponse).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Commandes' })).toBeVisible()
})
