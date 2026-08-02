import { createApiClient } from '@local-market/api-client'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import {
  loadFarmDetails,
  searchNearbyFarms,
  type FarmDetails,
  type NearbyFarmResponse,
} from '../farm-search'

export const Route = createFileRoute('/')({ component: Home })

const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})

function Home() {
  const [latitude, setLatitude] = useState('45.764')
  const [longitude, setLongitude] = useState('4.8357')
  const [radiusKm, setRadiusKm] = useState('20')
  const [result, setResult] = useState<NearbyFarmResponse>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<FarmDetails>()
  const [detailsLoading, setDetailsLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(undefined)

    try {
      const response = await searchNearbyFarms(api, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusKm: Number(radiusKm),
      })
      setResult(response)
      setDetails(undefined)
    } catch (caught) {
      setResult(undefined)
      setError(caught instanceof Error ? caught.message : 'La recherche a échoué.')
    } finally {
      setLoading(false)
    }
  }

  const openFarm = async (farmId: string) => {
    setDetailsLoading(true)
    setError(undefined)
    try {
      setDetails(await loadFarmDetails(api, farmId))
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "La fiche de l'exploitation est indisponible."
      )
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <main
      style={{ maxWidth: 760, margin: '3rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}
    >
      <h1>Exploitations près de chez vous</h1>
      <form
        onSubmit={submit}
        style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        <label>
          Latitude
          <input
            required
            type="number"
            min="-90"
            max="90"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            required
            type="number"
            min="-180"
            max="180"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
        </label>
        <label>
          Rayon (km)
          <input
            required
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={radiusKm}
            onChange={(event) => setRadiusKm(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {error !== undefined && <p role="alert">{error}</p>}
      {result?.farms.length === 0 && <p>Aucune exploitation trouvée dans ce rayon.</p>}
      {result !== undefined && result.farms.length > 0 && (
        <ul>
          {result.farms.map((farm) => (
            <li key={farm.id}>
              <h2>{farm.name}</h2>
              <p>
                {farm.city} ({farm.postalCode}) — {farm.distanceKm.toFixed(1)} km
              </p>
              {farm.description !== null && <p>{farm.description}</p>}
              <button type="button" onClick={() => void openFarm(farm.id)}>
                Voir les produits
              </button>
            </li>
          ))}
        </ul>
      )}
      {detailsLoading && <p>Chargement de la fiche…</p>}
      {details !== undefined && (
        <section>
          <h2>{details.farm.name}</h2>
          <p>
            {details.farm.location.addressLine1}, {details.farm.location.postalCode}{' '}
            {details.farm.location.city}
          </p>
          <h3>Produits disponibles</h3>
          {details.listings.length === 0 ? (
            <p>Aucun produit disponible actuellement.</p>
          ) : (
            <ul>
              {details.listings.map((listing) => (
                <li key={listing.id}>
                  {listing.title} — {(listing.priceCents / 100).toFixed(2)} {listing.currency} —{' '}
                  {listing.availableQuantity} disponible(s)
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
