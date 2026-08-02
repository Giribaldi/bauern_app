import type { Kysely } from 'kysely'
import type { Database } from '../../database/database.types'
import { DomainError } from '../../http/domain-error'
import type { AuthService } from '../auth/auth.service'

type Role = 'owner' | 'manager' | 'staff'
const writeRoles: Role[] = ['owner', 'manager']

export class AdminService {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auth: AuthService
  ) {}

  private async user(token: string) {
    const session = await this.auth.session(token)
    if (session === undefined)
      throw new DomainError(401, 'AUTHENTICATION_REQUIRED', 'La session est absente ou expirée.')
    return session
  }

  private async member(token: string, farmId: string, roles?: Role[]) {
    const session = await this.user(token)
    const membership = await this.database
      .selectFrom('farm_members')
      .select('role')
      .where('farm_id', '=', farmId)
      .where('user_id', '=', session.userId)
      .executeTakeFirst()
    if (membership === undefined || (roles !== undefined && !roles.includes(membership.role)))
      throw new DomainError(
        403,
        'FARM_ACCESS_DENIED',
        "Vous n'avez pas accès à cette exploitation."
      )
    return session
  }

  async farms(token: string) {
    const session = await this.user(token)
    return this.database
      .selectFrom('farm_members')
      .innerJoin('farms', 'farms.id', 'farm_members.farm_id')
      .select([
        'farms.id',
        'farms.name',
        'farms.slug',
        'farms.description',
        'farms.public_email as publicEmail',
        'farms.public_phone as publicPhone',
        'farms.is_active as isActive',
        'farm_members.role',
      ])
      .where('farm_members.user_id', '=', session.userId)
      .orderBy('farms.name')
      .execute()
  }

  async farm(token: string, farmId: string) {
    await this.member(token, farmId)
    const farm = await this.database
      .selectFrom('farms')
      .select([
        'id',
        'name',
        'slug',
        'description',
        'public_email as publicEmail',
        'public_phone as publicPhone',
        'is_active as isActive',
      ])
      .where('id', '=', farmId)
      .executeTakeFirst()
    if (farm === undefined)
      throw new DomainError(404, 'FARM_NOT_FOUND', "L'exploitation n'existe pas.")
    return farm
  }

  async updateFarm(
    token: string,
    farmId: string,
    input: {
      name?: string
      description?: string | null
      publicEmail?: string | null
      publicPhone?: string | null
      isActive?: boolean
    }
  ) {
    const user = await this.member(token, farmId, writeRoles)
    const values = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.publicEmail === undefined ? {} : { public_email: input.publicEmail }),
      ...(input.publicPhone === undefined ? {} : { public_phone: input.publicPhone }),
      ...(input.isActive === undefined ? {} : { is_active: input.isActive }),
      updated_at: new Date(),
    }
    await this.database.transaction().execute(async (trx) => {
      await trx.updateTable('farms').set(values).where('id', '=', farmId).executeTakeFirstOrThrow()
      await trx
        .insertInto('admin_audit_log')
        .values({
          user_id: user.userId,
          farm_id: farmId,
          action: 'farm.updated',
          entity_type: 'farm',
          entity_id: farmId,
          metadata: input,
        })
        .execute()
    })
    return this.farm(token, farmId)
  }

  async listings(token: string, farmId: string) {
    await this.member(token, farmId)
    return this.database
      .selectFrom('listings')
      .innerJoin('product_catalog', 'product_catalog.id', 'listings.product_catalog_id')
      .select([
        'listings.id',
        'listings.product_catalog_id as productCatalogId',
        'product_catalog.name as productName',
        'listings.title',
        'listings.description',
        'listings.variety',
        'listings.unit',
        'listings.unit_quantity as unitQuantity',
        'listings.price_cents as priceCents',
        'listings.currency',
        'listings.vat_rate as vatRate',
        'listings.is_active as isActive',
      ])
      .where('listings.farm_id', '=', farmId)
      .orderBy('listings.created_at', 'desc')
      .execute()
  }

  async listing(token: string, farmId: string, listingId: string) {
    const rows = await this.listings(token, farmId)
    const row = rows.find(({ id }) => id === listingId)
    if (row === undefined) throw new DomainError(404, 'LISTING_NOT_FOUND', "L'offre n'existe pas.")
    return row
  }

  async createListing(
    token: string,
    farmId: string,
    input: {
      productCatalogId: string
      title: string
      description?: string | null
      variety?: string | null
      unit: 'piece' | 'kilogram' | 'gram' | 'bunch' | 'box' | 'basket'
      unitQuantity: string
      priceCents: number
      vatRate: string
      isActive?: boolean
    }
  ) {
    const user = await this.member(token, farmId, writeRoles)
    const row = await this.database.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('listings')
        .values({
          farm_id: farmId,
          product_catalog_id: input.productCatalogId,
          title: input.title,
          description: input.description ?? null,
          variety: input.variety ?? null,
          unit: input.unit,
          unit_quantity: input.unitQuantity,
          price_cents: input.priceCents,
          currency: 'EUR',
          vat_rate: input.vatRate,
          is_active: input.isActive ?? true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      await trx
        .insertInto('inventory_batches')
        .values({
          listing_id: created.id,
          available_quantity: '0',
          reserved_quantity: '0',
          harvested_at: null,
          expires_at: null,
        })
        .execute()
      await trx
        .insertInto('admin_audit_log')
        .values({
          user_id: user.userId,
          farm_id: farmId,
          action: 'listing.created',
          entity_type: 'listing',
          entity_id: created.id,
          metadata: {},
        })
        .execute()
      return created
    })
    return this.listing(token, farmId, row.id)
  }

  async updateListing(
    token: string,
    farmId: string,
    listingId: string,
    input: {
      title?: string
      description?: string | null
      variety?: string | null
      priceCents?: number
      vatRate?: string
      isActive?: boolean
    }
  ) {
    const user = await this.member(token, farmId, writeRoles)
    await this.listing(token, farmId, listingId)
    const values = {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.variety === undefined ? {} : { variety: input.variety }),
      ...(input.priceCents === undefined ? {} : { price_cents: input.priceCents }),
      ...(input.vatRate === undefined ? {} : { vat_rate: input.vatRate }),
      ...(input.isActive === undefined ? {} : { is_active: input.isActive }),
      updated_at: new Date(),
    }
    await this.database.transaction().execute(async (trx) => {
      await trx
        .updateTable('listings')
        .set(values)
        .where('id', '=', listingId)
        .where('farm_id', '=', farmId)
        .execute()
      await trx
        .insertInto('admin_audit_log')
        .values({
          user_id: user.userId,
          farm_id: farmId,
          action: 'listing.updated',
          entity_type: 'listing',
          entity_id: listingId,
          metadata: input,
        })
        .execute()
    })
    return this.listing(token, farmId, listingId)
  }

  async inventory(token: string, farmId: string) {
    await this.member(token, farmId)
    const batches = await this.database
      .selectFrom('inventory_batches')
      .innerJoin('listings', 'listings.id', 'inventory_batches.listing_id')
      .select([
        'inventory_batches.id',
        'listings.id as listingId',
        'listings.title',
        'inventory_batches.available_quantity as availableQuantity',
        'inventory_batches.reserved_quantity as reservedQuantity',
      ])
      .where('listings.farm_id', '=', farmId)
      .orderBy('listings.title')
      .execute()
    const movements = await this.database
      .selectFrom('stock_movements')
      .select([
        'id',
        'inventory_batch_id as inventoryBatchId',
        'type',
        'quantity',
        'reason',
        'created_at as createdAt',
      ])
      .where('farm_id', '=', farmId)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute()
    return {
      batches,
      movements: movements.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt).toISOString(),
      })),
    }
  }

  async moveStock(
    token: string,
    farmId: string,
    input: {
      inventoryBatchId: string
      type: 'stock_added' | 'stock_corrected' | 'stock_lost' | 'stock_refunded'
      quantity: string
      reason?: string
    }
  ) {
    const user = await this.member(token, farmId, writeRoles)
    const quantity = Number(input.quantity)
    if (!Number.isFinite(quantity) || quantity === 0)
      throw new DomainError(400, 'INVALID_STOCK_QUANTITY', 'La quantité doit être non nulle.')
    if (input.type === 'stock_corrected' && (input.reason?.trim() ?? '') === '')
      throw new DomainError(400, 'STOCK_REASON_REQUIRED', 'Une correction exige un motif.')
    await this.database.transaction().execute(async (trx) => {
      const batch = await trx
        .selectFrom('inventory_batches')
        .innerJoin('listings', 'listings.id', 'inventory_batches.listing_id')
        .select([
          'inventory_batches.available_quantity as available',
          'inventory_batches.reserved_quantity as reserved',
        ])
        .where('inventory_batches.id', '=', input.inventoryBatchId)
        .where('listings.farm_id', '=', farmId)
        .forUpdate()
        .executeTakeFirst()
      if (batch === undefined)
        throw new DomainError(404, 'INVENTORY_BATCH_NOT_FOUND', "Le lot n'existe pas.")
      const next = Number(batch.available) + quantity
      if (next < Number(batch.reserved) || next < 0)
        throw new DomainError(
          409,
          'INSUFFICIENT_STOCK',
          'La quantité disponible ne peut pas devenir négative ou inférieure au stock réservé.'
        )
      await trx
        .updateTable('inventory_batches')
        .set({ available_quantity: next.toFixed(3), updated_at: new Date() })
        .where('id', '=', input.inventoryBatchId)
        .execute()
      await trx
        .insertInto('stock_movements')
        .values({
          inventory_batch_id: input.inventoryBatchId,
          farm_id: farmId,
          actor_user_id: user.userId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason ?? null,
        })
        .execute()
      await trx
        .insertInto('admin_audit_log')
        .values({
          user_id: user.userId,
          farm_id: farmId,
          action: 'inventory.moved',
          entity_type: 'inventory_batch',
          entity_id: input.inventoryBatchId,
          metadata: { type: input.type, quantity: input.quantity },
        })
        .execute()
    })
    return this.inventory(token, farmId)
  }

  async orders(token: string, farmId: string) {
    await this.member(token, farmId)
    return this.database
      .selectFrom('orders')
      .select([
        'id',
        'public_reference as reference',
        'guest_email as guestEmail',
        'status',
        'currency',
        'total_cents as totalCents',
        'created_at as createdAt',
      ])
      .where('farm_id', '=', farmId)
      .orderBy('created_at', 'desc')
      .execute()
  }
  async updateOrder(
    token: string,
    farmId: string,
    orderId: string,
    status: 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'refunded'
  ) {
    const user = await this.member(token, farmId, writeRoles)
    const current = await this.database
      .selectFrom('orders')
      .select('status')
      .where('id', '=', orderId)
      .where('farm_id', '=', farmId)
      .executeTakeFirst()
    if (current === undefined)
      throw new DomainError(404, 'ORDER_NOT_FOUND', "La commande n'existe pas.")
    const allowed: Record<string, string[]> = {
      paid: ['preparing', 'refunded'],
      preparing: ['ready_for_pickup', 'cancelled'],
      ready_for_pickup: ['completed', 'cancelled'],
      completed: ['refunded'],
    }
    if (!(allowed[current.status] ?? []).includes(status))
      throw new DomainError(
        409,
        'INVALID_ORDER_TRANSITION',
        'Ce changement de statut est interdit.'
      )
    await this.database.transaction().execute(async (trx) => {
      await trx
        .updateTable('orders')
        .set({ status, updated_at: new Date() })
        .where('id', '=', orderId)
        .execute()
      await trx
        .insertInto('admin_audit_log')
        .values({
          user_id: user.userId,
          farm_id: farmId,
          action: 'order.status_changed',
          entity_type: 'order',
          entity_id: orderId,
          metadata: { from: current.status, to: status },
        })
        .execute()
      if (status === 'ready_for_pickup' || status === 'cancelled') {
        const order = await trx
          .selectFrom('orders')
          .select('guest_email')
          .where('id', '=', orderId)
          .executeTakeFirstOrThrow()
        await trx
          .insertInto('email_jobs')
          .values({
            order_id: orderId,
            template: status,
            recipient: order.guest_email,
            payload: { orderId },
            processed_at: null,
            last_error: null,
          })
          .execute()
      }
    })
    return { id: orderId, status }
  }
}
