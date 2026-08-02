import { createApiClient } from '@local-market/api-client'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'

export const Route = createFileRoute('/')({ component: Admin })
const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000' })
type Farm = { id: string; name: string; role: string }
type Listing = { id: string; title: string; priceCents: number; isActive: boolean }
type Inventory = {
  batches: { id: string; title: string; availableQuantity: string; reservedQuantity: string }[]
  movements: { id: string; type: string; quantity: string; reason: string | null }[]
}
type Order = { id: string; reference: string; status: string; totalCents: number }

function Admin() {
  const [hydrated, setHydrated] = useState(false)
  const [email, setEmail] = useState('alice.seed@local-market.test')
  const [password, setPassword] = useState('Maraicher-2026!')
  const [farms, setFarms] = useState<Farm[]>([])
  const [farmId, setFarmId] = useState('')
  const [listings, setListings] = useState<Listing[]>([])
  const [inventory, setInventory] = useState<Inventory>()
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const refresh = async (id: string) => {
    const [nextListings, nextInventory, nextOrders] = await Promise.all([
      api.request<Listing[]>(`/v1/admin/farms/${id}/listings`),
      api.request<Inventory>(`/v1/admin/farms/${id}/inventory`),
      api.request<Order[]>(`/v1/admin/farms/${id}/orders`),
    ])
    setListings(nextListings)
    setInventory(nextInventory)
    setOrders(nextOrders)
  }
  const loadFarms = async () => {
    try {
      const result = await api.request<Farm[]>('/v1/admin/farms')
      setFarms(result)
      if (result[0] !== undefined) {
        setFarmId(result[0].id)
        await refresh(result[0].id)
      }
    } catch {
      /* login is shown */
    }
  }
  useEffect(() => {
    setHydrated(true)
    void loadFarms()
  }, [])
  const login = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await api.request('/v1/auth/login', { method: 'POST', body: { email, password } })
      await loadFarms()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connexion refusée.')
    }
  }
  const createListing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await api.request(`/v1/admin/farms/${farmId}/listings`, {
      method: 'POST',
      body: {
        productCatalogId: form.get('product'),
        title: form.get('title'),
        unit: 'piece',
        unitQuantity: '1',
        priceCents: Number(form.get('price')),
        vatRate: '5.50',
      },
    })
    formElement.reset()
    await refresh(farmId)
  }
  const move = async (batchId: string, quantity: string, reason?: string) => {
    await api.request(`/v1/admin/farms/${farmId}/inventory/movements`, {
      method: 'POST',
      body: {
        inventoryBatchId: batchId,
        type: reason === undefined ? 'stock_added' : 'stock_corrected',
        quantity,
        reason,
      },
    })
    await refresh(farmId)
  }
  if (farms.length === 0)
    return (
      <main style={shell}>
        <h1>Back-office producteurs</h1>
        <form onSubmit={(event) => void login(event)} style={grid}>
          <label>
            E-mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button disabled={!hydrated}>Se connecter</button>
          {error && <p role="alert">{error}</p>}
        </form>
      </main>
    )
  return (
    <main style={shell}>
      <header>
        <h1>Tableau de bord</h1>
        <select
          value={farmId}
          onChange={(e) => {
            setFarmId(e.target.value)
            void refresh(e.target.value)
          }}
        >
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name} · {farm.role}
            </option>
          ))}
        </select>
      </header>
      <section>
        <h2>Créer une offre</h2>
        <form onSubmit={(event) => void createListing(event)} style={grid}>
          <input name="title" placeholder="Nom de l’offre" required />
          <input name="product" placeholder="UUID produit catalogue" required />
          <input name="price" type="number" min="0" placeholder="Prix en centimes" required />
          <button>Publier</button>
        </form>
        <ul>
          {listings.map((item) => (
            <li key={item.id}>
              {item.title} — {(item.priceCents / 100).toFixed(2)} € —{' '}
              {item.isActive ? 'active' : 'inactive'}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Stock</h2>
        {inventory?.batches.map((batch) => (
          <article key={batch.id}>
            <strong>{batch.title}</strong> : {batch.availableQuantity} ({batch.reservedQuantity}{' '}
            réservé)<button onClick={() => void move(batch.id, '1')}>+ 1</button>
            <button
              onClick={() => {
                const reason = prompt('Motif obligatoire')
                if (reason) void move(batch.id, '-1', reason)
              }}
            >
              Corriger − 1
            </button>
          </article>
        ))}
        <h3>Historique</h3>
        <ul>
          {inventory?.movements.map((movement) => (
            <li key={movement.id}>
              {movement.type} · {movement.quantity} · {movement.reason}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Commandes</h2>
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              {order.reference} · {order.status} · {(order.totalCents / 100).toFixed(2)} €
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
const shell = {
  maxWidth: 960,
  margin: '2rem auto',
  padding: '1rem',
  fontFamily: 'system-ui',
  color: '#17351f',
}
const grid = { display: 'grid', gap: '1rem', maxWidth: 520 }
