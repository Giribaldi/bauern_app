import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient } from 'pg'

const releaseExpiredReservations = async (client: PoolClient): Promise<number> => {
  await client.query('begin')
  try {
    const { rows } = await client.query<{
      id: string
      order_id: string
      inventory_batch_id: string
      quantity: string
      farm_id: string
    }>(`
      select sr.id, sr.order_id, sr.inventory_batch_id, sr.quantity, l.farm_id
      from stock_reservations sr
      join inventory_batches ib on ib.id = sr.inventory_batch_id
      join listings l on l.id = ib.listing_id
      where sr.status = 'active' and sr.expires_at <= now()
      for update of sr, ib skip locked
    `)
    for (const row of rows) {
      await client.query(
        'update inventory_batches set reserved_quantity = reserved_quantity - $1, updated_at = now() where id = $2',
        [row.quantity, row.inventory_batch_id]
      )
      await client.query("update stock_reservations set status = 'released' where id = $1", [
        row.id,
      ])
      await client.query(
        "insert into stock_movements (inventory_batch_id, farm_id, type, quantity, reason) values ($1, $2, 'reservation_released', $3, 'Réservation expirée')",
        [row.inventory_batch_id, row.farm_id, row.quantity]
      )
      await client.query(
        "update orders set status = 'cancelled', updated_at = now() where id = $1 and status = 'pending_payment'",
        [row.order_id]
      )
    }
    await client.query('commit')
    return rows.length
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

const smtpCommand = (socket: ReturnType<typeof createConnection>, command: string): void => {
  socket.write(`${command}\r\n`)
}
const sendMail = (
  host: string,
  port: number,
  recipient: string,
  subject: string,
  text: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = createConnection(port, host)
    let step = 0
    socket.setEncoding('utf8')
    socket.on('error', reject)
    socket.on('data', () => {
      step += 1
      if (step === 1) smtpCommand(socket, 'EHLO local-market-worker')
      else if (step === 2) smtpCommand(socket, 'MAIL FROM:<no-reply@local-market.test>')
      else if (step === 3) smtpCommand(socket, `RCPT TO:<${recipient.replaceAll(/[\r\n<>]/g, '')}>`)
      else if (step === 4) smtpCommand(socket, 'DATA')
      else if (step === 5)
        smtpCommand(
          socket,
          `From: Marché local <no-reply@local-market.test>\r\nTo: ${recipient}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text.replaceAll('\r\n.', '\r\n..')}\r\n.`
        )
      else if (step === 6) smtpCommand(socket, 'QUIT')
      else {
        socket.end()
        resolve()
      }
    })
  })

const processEmail = async (client: PoolClient, host: string, port: number): Promise<boolean> => {
  const { rows } = await client.query<{
    id: string
    recipient: string
    template: string
    payload: unknown
  }>(
    'select id, recipient, template, payload from email_jobs where processed_at is null and available_at <= now() order by created_at for update skip locked limit 1'
  )
  const job = rows[0]
  if (job === undefined) return false
  try {
    const subjects: Record<string, string> = {
      order_confirmation: 'Confirmation de votre commande',
      ready_for_pickup: 'Votre commande est prête',
      cancelled: 'Votre commande est annulée',
    }
    await sendMail(
      host,
      port,
      job.recipient,
      subjects[job.template] ?? 'Mise à jour de votre commande',
      `Votre commande a été mise à jour.\n\n${JSON.stringify(job.payload)}`
    )
    await client.query(
      'update email_jobs set processed_at = now(), attempts = attempts + 1, last_error = null where id = $1',
      [job.id]
    )
  } catch {
    await client.query(
      "update email_jobs set attempts = attempts + 1, available_at = now() + interval '5 minutes', last_error = 'SMTP delivery failed' where id = $1",
      [job.id]
    )
  }
  return true
}

export const runWorkerCycle = async (
  pool: Pool,
  smtpHost = 'mailpit',
  smtpPort = 1025
): Promise<{ released: number; emailProcessed: boolean }> => {
  const client = await pool.connect()
  try {
    const released = await releaseExpiredReservations(client)
    const emailProcessed = await processEmail(client, smtpHost, smtpPort)
    return { released, emailProcessed }
  } finally {
    client.release()
  }
}

export const startWorker = async (): Promise<void> => {
  if (process.env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required.')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const stop = async () => {
    await pool.end()
    process.exitCode = 0
  }
  process.once('SIGTERM', () => void stop())
  process.once('SIGINT', () => void stop())
  const cycle = async () => {
    try {
      await runWorkerCycle(pool, process.env.SMTP_HOST, Number(process.env.SMTP_PORT ?? '1025'))
    } catch (error) {
      console.error('Worker cycle failed', error instanceof Error ? error.message : 'unknown error')
    }
  }
  await cycle()
  setInterval(() => void cycle(), 30_000)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void startWorker()
