import { createHash, randomBytes } from 'node:crypto'
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../../database/database.types'
import { DomainError } from '../../http/domain-error'
import type { PaymentProvider } from './payment'

const digest = (value: string): string => createHash('sha256').update(value).digest('hex')
const money = (price: number, quantity: string): number => Math.round(price * Number(quantity))

export class CommerceService {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly payment: PaymentProvider,
    private readonly publicBaseUrl: string,
    private readonly reservationMinutes = 15
  ) {}

  async createCart() {
    const token = randomBytes(24).toString('base64url')
    const row = await this.database
      .insertInto('carts')
      .values({
        token_hash: digest(token),
        farm_id: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60_000),
        checked_out_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    return {
      cartId: `${row.id}.${token}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      currency: 'EUR',
      items: [],
      totalCents: 0,
    }
  }
  private parseCart(value: string) {
    const split = value.indexOf('.')
    if (split < 1) throw new DomainError(404, 'CART_NOT_FOUND', "Le panier n'existe pas.")
    return { id: value.slice(0, split), hash: digest(value.slice(split + 1)) }
  }
  private async cartRow(value: string) {
    const key = this.parseCart(value)
    const cart = await this.database
      .selectFrom('carts')
      .selectAll()
      .where('id', '=', key.id)
      .where('token_hash', '=', key.hash)
      .where('expires_at', '>', new Date())
      .executeTakeFirst()
    if (cart === undefined)
      throw new DomainError(404, 'CART_NOT_FOUND', 'Le panier est absent ou expiré.')
    return { cart, key }
  }
  async getCart(value: string) {
    const { cart } = await this.cartRow(value)
    const items = await this.database
      .selectFrom('cart_items')
      .innerJoin('listings', 'listings.id', 'cart_items.listing_id')
      .innerJoin('farms', 'farms.id', 'listings.farm_id')
      .select([
        'cart_items.id',
        'listings.id as listingId',
        'listings.title',
        'farms.id as farmId',
        'farms.name as farmName',
        'cart_items.quantity',
        'listings.price_cents as priceCents',
        'listings.currency',
      ])
      .where('cart_items.cart_id', '=', cart.id)
      .orderBy('cart_items.created_at')
      .execute()
    return {
      cartId: value,
      farmId: cart.farm_id,
      currency: cart.currency,
      expiresAt: new Date(cart.expires_at).toISOString(),
      items: items.map((item) => ({ ...item, totalCents: money(item.priceCents, item.quantity) })),
      totalCents: items.reduce((sum, item) => sum + money(item.priceCents, item.quantity), 0),
    }
  }
  async addItem(value: string, listingId: string, quantity: string) {
    const { cart } = await this.cartRow(value)
    if (cart.checked_out_at !== null)
      throw new DomainError(409, 'CART_ALREADY_CHECKED_OUT', 'Ce panier a déjà été validé.')
    const listing = await this.database
      .selectFrom('listings')
      .select(['farm_id', 'currency', 'is_active'])
      .where('id', '=', listingId)
      .executeTakeFirst()
    if (listing === undefined || !listing.is_active)
      throw new DomainError(404, 'LISTING_NOT_FOUND', "L'offre n'existe pas.")
    if (cart.farm_id !== null && cart.farm_id !== listing.farm_id)
      throw new DomainError(
        409,
        'MULTI_FARM_CART_NOT_ALLOWED',
        "Une commande ne peut contenir qu'une seule exploitation."
      )
    await this.database.transaction().execute(async (trx) => {
      await trx
        .updateTable('carts')
        .set({ farm_id: listing.farm_id, currency: listing.currency, updated_at: new Date() })
        .where('id', '=', cart.id)
        .execute()
      await trx
        .insertInto('cart_items')
        .values({ cart_id: cart.id, listing_id: listingId, quantity })
        .onConflict((conflict) =>
          conflict
            .columns(['cart_id', 'listing_id'])
            .doUpdateSet({ quantity, updated_at: new Date() })
        )
        .execute()
    })
    return this.getCart(value)
  }
  async updateItem(value: string, itemId: string, quantity: string) {
    const { cart } = await this.cartRow(value)
    const changed = await this.database
      .updateTable('cart_items')
      .set({ quantity, updated_at: new Date() })
      .where('id', '=', itemId)
      .where('cart_id', '=', cart.id)
      .executeTakeFirst()
    if (Number(changed.numUpdatedRows) === 0)
      throw new DomainError(404, 'CART_ITEM_NOT_FOUND', "L'article n'existe pas.")
    return this.getCart(value)
  }
  async deleteItem(value: string, itemId: string) {
    const { cart } = await this.cartRow(value)
    await this.database
      .deleteFrom('cart_items')
      .where('id', '=', itemId)
      .where('cart_id', '=', cart.id)
      .execute()
    const left = await this.database
      .selectFrom('cart_items')
      .select('id')
      .where('cart_id', '=', cart.id)
      .limit(1)
      .executeTakeFirst()
    if (left === undefined)
      await this.database
        .updateTable('carts')
        .set({ farm_id: null, updated_at: new Date() })
        .where('id', '=', cart.id)
        .execute()
    return this.getCart(value)
  }

  private async reserve(trx: Transaction<Database>, cartId: string, email: string, key: string) {
    const existing = await trx
      .selectFrom('orders')
      .selectAll()
      .where('checkout_key', '=', key)
      .executeTakeFirst()
    if (existing !== undefined) return { order: existing, guestToken: undefined }
    const cart = await trx
      .selectFrom('carts')
      .selectAll()
      .where('id', '=', cartId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (cart.checked_out_at !== null)
      throw new DomainError(409, 'CART_ALREADY_CHECKED_OUT', 'Ce panier a déjà été validé.')
    const items = await trx
      .selectFrom('cart_items')
      .innerJoin('listings', 'listings.id', 'cart_items.listing_id')
      .innerJoin('farms', 'farms.id', 'listings.farm_id')
      .select([
        'listings.id as listingId',
        'listings.title',
        'listings.variety',
        'listings.unit',
        'listings.unit_quantity as unitQuantity',
        'listings.price_cents as priceCents',
        'listings.vat_rate as vatRate',
        'listings.currency',
        'listings.farm_id as farmId',
        'farms.name as farmName',
        'cart_items.quantity',
      ])
      .where('cart_items.cart_id', '=', cartId)
      .where('listings.is_active', '=', true)
      .execute()
    if (items.length === 0) throw new DomainError(409, 'EMPTY_CART', 'Le panier est vide.')
    const reference = `LM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
    const total = items.reduce((sum, item) => sum + money(item.priceCents, item.quantity), 0)
    const order = await trx
      .insertInto('orders')
      .values({
        public_reference: reference,
        farm_id: items[0]!.farmId,
        user_id: null,
        guest_email: email.trim().toLowerCase(),
        status: 'pending_payment',
        currency: items[0]!.currency,
        total_cents: total,
        checkout_key: key,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    const expiresAt = new Date(Date.now() + this.reservationMinutes * 60_000)
    for (const item of items) {
      let needed = Number(item.quantity)
      const batches = await trx
        .selectFrom('inventory_batches')
        .selectAll()
        .where('listing_id', '=', item.listingId)
        .orderBy('expires_at', 'asc')
        .forUpdate()
        .execute()
      for (const batch of batches) {
        const free = Number(batch.available_quantity) - Number(batch.reserved_quantity)
        const take = Math.min(free, needed)
        if (take <= 0) continue
        await trx
          .updateTable('inventory_batches')
          .set({
            reserved_quantity: (Number(batch.reserved_quantity) + take).toFixed(3),
            updated_at: new Date(),
          })
          .where('id', '=', batch.id)
          .execute()
        await trx
          .insertInto('stock_reservations')
          .values({
            order_id: order.id,
            inventory_batch_id: batch.id,
            quantity: take.toFixed(3),
            status: 'active',
            expires_at: expiresAt,
          })
          .execute()
        await trx
          .insertInto('stock_movements')
          .values({
            inventory_batch_id: batch.id,
            farm_id: item.farmId,
            actor_user_id: null,
            type: 'stock_reserved',
            quantity: take.toFixed(3),
            reason: `Commande ${reference}`,
          })
          .execute()
        needed -= take
        if (needed <= 0) break
      }
      if (needed > 0)
        throw new DomainError(409, 'INSUFFICIENT_STOCK', `Stock insuffisant pour ${item.title}.`)
      await trx
        .insertInto('order_items')
        .values({
          order_id: order.id,
          listing_id: item.listingId,
          product_name: item.title,
          farm_name: item.farmName,
          variety: item.variety,
          unit: item.unit,
          unit_quantity: item.unitQuantity,
          price_cents: item.priceCents,
          vat_rate: item.vatRate,
          quantity: item.quantity,
          total_cents: money(item.priceCents, item.quantity),
        })
        .execute()
    }
    const guestToken = randomBytes(32).toString('base64url')
    await trx
      .insertInto('guest_order_access')
      .values({
        order_id: order.id,
        token_hash: digest(guestToken),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        revoked_at: null,
      })
      .execute()
    await trx
      .updateTable('carts')
      .set({ checked_out_at: new Date(), updated_at: new Date() })
      .where('id', '=', cartId)
      .execute()
    return { order, guestToken }
  }

  async checkout(cartValue: string, email: string, idempotencyKey: string) {
    const { cart } = await this.cartRow(cartValue)
    const key = digest(`${cart.id}:${idempotencyKey}`)
    const reserved = await this.database
      .transaction()
      .setIsolationLevel('serializable')
      .execute((trx) => this.reserve(trx, cart.id, email, key))
    const previous = await this.database
      .selectFrom('payments')
      .selectAll()
      .where('order_id', '=', reserved.order.id)
      .executeTakeFirst()
    if (previous !== undefined)
      return {
        orderId: reserved.order.id,
        reference: reserved.order.public_reference,
        checkoutUrl: previous.checkout_url,
        guestToken: reserved.guestToken,
      }
    const session = await this.payment.createCheckoutSession({
      orderId: reserved.order.id,
      reference: reserved.order.public_reference,
      amountCents: reserved.order.total_cents,
      currency: reserved.order.currency,
      successUrl: `${this.publicBaseUrl}/commande?status=success`,
      cancelUrl: `${this.publicBaseUrl}/panier`,
    })
    await this.database
      .insertInto('payments')
      .values({
        order_id: reserved.order.id,
        provider: 'stripe',
        provider_session_id: session.id,
        status: 'pending',
        amount_cents: reserved.order.total_cents,
        currency: reserved.order.currency,
        checkout_url: session.url,
      })
      .execute()
    if (reserved.guestToken !== undefined)
      await this.database
        .insertInto('email_jobs')
        .values({
          order_id: reserved.order.id,
          template: 'order_confirmation',
          recipient: reserved.order.guest_email,
          payload: { reference: reserved.order.public_reference },
          processed_at: null,
          last_error: null,
        })
        .execute()
    return {
      orderId: reserved.order.id,
      reference: reserved.order.public_reference,
      checkoutUrl: session.url,
      guestToken: reserved.guestToken,
    }
  }

  async guestOrder(token: string) {
    const access = await this.database
      .selectFrom('guest_order_access')
      .innerJoin('orders', 'orders.id', 'guest_order_access.order_id')
      .innerJoin('farms', 'farms.id', 'orders.farm_id')
      .select([
        'orders.id',
        'orders.public_reference as reference',
        'orders.status',
        'orders.currency',
        'orders.total_cents as totalCents',
        'orders.created_at as createdAt',
        'farms.name as farmName',
      ])
      .where('guest_order_access.token_hash', '=', digest(token))
      .where('guest_order_access.revoked_at', 'is', null)
      .where('guest_order_access.expires_at', '>', new Date())
      .executeTakeFirst()
    if (access === undefined)
      throw new DomainError(
        404,
        'GUEST_ORDER_NOT_FOUND',
        'Ce lien de suivi est invalide ou expiré.'
      )
    const items = await this.database
      .selectFrom('order_items')
      .select([
        'product_name as productName',
        'variety',
        'unit',
        'unit_quantity as unitQuantity',
        'price_cents as priceCents',
        'vat_rate as vatRate',
        'quantity',
        'total_cents as totalCents',
      ])
      .where('order_id', '=', access.id)
      .execute()
    return { ...access, createdAt: new Date(access.createdAt).toISOString(), items }
  }

  async webhook(payload: string, signature: string | undefined) {
    const event = await this.payment.verifyWebhook({ payload, signature })
    await this.database.transaction().execute(async (trx) => {
      const payment = await trx
        .selectFrom('payments')
        .selectAll()
        .where('provider_session_id', '=', event.sessionId)
        .executeTakeFirst()
      if (payment === undefined)
        throw new DomainError(404, 'PAYMENT_NOT_FOUND', 'Le paiement est inconnu.')
      const inserted = await trx
        .insertInto('payment_events')
        .values({
          provider: 'stripe',
          provider_event_id: event.id,
          event_type: event.type,
          payload: JSON.parse(payload),
        })
        .onConflict((conflict) => conflict.columns(['provider', 'provider_event_id']).doNothing())
        .returning('id')
        .executeTakeFirst()
      if (inserted === undefined) return
      const reservations = await trx
        .selectFrom('stock_reservations')
        .innerJoin(
          'inventory_batches',
          'inventory_batches.id',
          'stock_reservations.inventory_batch_id'
        )
        .innerJoin('listings', 'listings.id', 'inventory_batches.listing_id')
        .select([
          'stock_reservations.id',
          'stock_reservations.inventory_batch_id as batchId',
          'stock_reservations.quantity',
          'inventory_batches.available_quantity as available',
          'inventory_batches.reserved_quantity as reserved',
          'listings.farm_id as farmId',
        ])
        .where('stock_reservations.order_id', '=', payment.order_id)
        .where('stock_reservations.status', '=', 'active')
        .forUpdate()
        .execute()
      const completed = event.type === 'checkout.completed'
      for (const reservation of reservations) {
        await trx
          .updateTable('inventory_batches')
          .set({
            available_quantity: (
              Number(reservation.available) - (completed ? Number(reservation.quantity) : 0)
            ).toFixed(3),
            reserved_quantity: (
              Number(reservation.reserved) - Number(reservation.quantity)
            ).toFixed(3),
            updated_at: new Date(),
          })
          .where('id', '=', reservation.batchId)
          .execute()
        await trx
          .updateTable('stock_reservations')
          .set({ status: completed ? 'consumed' : 'released' })
          .where('id', '=', reservation.id)
          .execute()
        await trx
          .insertInto('stock_movements')
          .values({
            inventory_batch_id: reservation.batchId,
            farm_id: reservation.farmId,
            actor_user_id: null,
            type: completed ? 'stock_sold' : 'reservation_released',
            quantity: reservation.quantity,
            reason: `Paiement ${event.id}`,
          })
          .execute()
      }
      await trx
        .updateTable('payments')
        .set({ status: completed ? 'paid' : 'expired', updated_at: new Date() })
        .where('id', '=', payment.id)
        .execute()
      await trx
        .updateTable('orders')
        .set({ status: completed ? 'paid' : 'cancelled', updated_at: new Date() })
        .where('id', '=', payment.order_id)
        .execute()
    })
    return { received: true }
  }

  async releaseExpired() {
    const orders = await this.database
      .selectFrom('stock_reservations')
      .select('order_id')
      .distinct()
      .where('status', '=', 'active')
      .where('expires_at', '<=', new Date())
      .execute()
    let released = 0
    for (const { order_id } of orders) {
      await this.database.transaction().execute(async (trx) => {
        const reservations = await trx
          .selectFrom('stock_reservations')
          .innerJoin(
            'inventory_batches',
            'inventory_batches.id',
            'stock_reservations.inventory_batch_id'
          )
          .innerJoin('listings', 'listings.id', 'inventory_batches.listing_id')
          .select([
            'stock_reservations.id',
            'stock_reservations.inventory_batch_id as batchId',
            'stock_reservations.quantity',
            'inventory_batches.reserved_quantity as reserved',
            'listings.farm_id as farmId',
          ])
          .where('stock_reservations.order_id', '=', order_id)
          .where('stock_reservations.status', '=', 'active')
          .forUpdate()
          .execute()
        for (const reservation of reservations) {
          await trx
            .updateTable('inventory_batches')
            .set({
              reserved_quantity: (
                Number(reservation.reserved) - Number(reservation.quantity)
              ).toFixed(3),
              updated_at: new Date(),
            })
            .where('id', '=', reservation.batchId)
            .execute()
          await trx
            .updateTable('stock_reservations')
            .set({ status: 'released' })
            .where('id', '=', reservation.id)
            .execute()
          await trx
            .insertInto('stock_movements')
            .values({
              inventory_batch_id: reservation.batchId,
              farm_id: reservation.farmId,
              actor_user_id: null,
              type: 'reservation_released',
              quantity: reservation.quantity,
              reason: 'Réservation expirée',
            })
            .execute()
          released += 1
        }
        await trx
          .updateTable('orders')
          .set({ status: 'cancelled', updated_at: new Date() })
          .where('id', '=', order_id)
          .where('status', '=', 'pending_payment')
          .execute()
      })
    }
    return released
  }
}
