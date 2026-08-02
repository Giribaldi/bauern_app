import { createHmac, timingSafeEqual } from 'node:crypto'
import { DomainError } from '../../http/domain-error'

export interface CheckoutSession {
  readonly id: string
  readonly url: string
}
export interface VerifiedPaymentEvent {
  readonly id: string
  readonly type: 'checkout.completed' | 'checkout.expired'
  readonly sessionId: string
}
export interface PaymentProvider {
  createCheckoutSession(input: {
    orderId: string
    reference: string
    amountCents: number
    currency: string
    successUrl: string
    cancelUrl: string
  }): Promise<CheckoutSession>
  verifyWebhook(input: {
    payload: string
    signature: string | undefined
  }): Promise<VerifiedPaymentEvent>
}

export class StripePaymentProvider implements PaymentProvider {
  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string
  ) {}
  async createCheckoutSession(input: {
    orderId: string
    reference: string
    amountCents: number
    currency: string
    successUrl: string
    cancelUrl: string
  }): Promise<CheckoutSession> {
    const body = new URLSearchParams({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.orderId,
      'metadata[order_id]': input.orderId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(input.amountCents),
      'line_items[0][price_data][product_data][name]': `Commande ${input.reference}`,
    })
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const value = (await response.json()) as {
      id?: string
      url?: string
      error?: { message?: string }
    }
    if (!response.ok || value.id === undefined || value.url === undefined)
      throw new DomainError(
        502,
        'PAYMENT_PROVIDER_ERROR',
        'Le prestataire de paiement est indisponible.'
      )
    return { id: value.id, url: value.url }
  }
  async verifyWebhook({
    payload,
    signature,
  }: {
    payload: string
    signature: string | undefined
  }): Promise<VerifiedPaymentEvent> {
    if (signature === undefined)
      throw new DomainError(400, 'INVALID_WEBHOOK_SIGNATURE', 'La signature Stripe est absente.')
    const parts = Object.fromEntries(signature.split(',').map((part) => part.split('=', 2)))
    const timestamp = parts.t
    const expected = parts.v1
    if (
      timestamp === undefined ||
      expected === undefined ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
    )
      throw new DomainError(400, 'INVALID_WEBHOOK_SIGNATURE', 'La signature Stripe est invalide.')
    const actual = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    const valid =
      actual.length === expected.length &&
      timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    if (!valid)
      throw new DomainError(400, 'INVALID_WEBHOOK_SIGNATURE', 'La signature Stripe est invalide.')
    const event = JSON.parse(payload) as {
      id?: string
      type?: string
      data?: { object?: { id?: string } }
    }
    const type =
      event.type === 'checkout.session.completed'
        ? 'checkout.completed'
        : event.type === 'checkout.session.expired'
          ? 'checkout.expired'
          : undefined
    if (event.id === undefined || type === undefined || event.data?.object?.id === undefined)
      throw new DomainError(
        400,
        'UNSUPPORTED_PAYMENT_EVENT',
        "L'événement Stripe n'est pas pris en charge."
      )
    return { id: event.id, type, sessionId: event.data.object.id }
  }
}

export class FakePaymentProvider implements PaymentProvider {
  private count = 0
  async createCheckoutSession(input: { orderId: string }): Promise<CheckoutSession> {
    this.count += 1
    return {
      id: `cs_test_${this.count}_${input.orderId}`,
      url: `https://checkout.stripe.test/${this.count}`,
    }
  }
  async verifyWebhook({ payload }: { payload: string }): Promise<VerifiedPaymentEvent> {
    return JSON.parse(payload) as VerifiedPaymentEvent
  }
}
