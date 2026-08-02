import { createApiClient } from '@local-market/api-client'
import { useEffect, useState, type ReactElement } from 'react'
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

const api = createApiClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000' })
type Farm = { id: string; name: string; city: string; distanceKm: number }
type Listing = { id: string; title: string; priceCents: number; availableQuantity: string }
type Cart = {
  cartId: string
  items: { id: string; title: string; quantity: string }[]
  totalCents: number
}

export default function App(): ReactElement {
  const [locationAllowed, setLocationAllowed] = useState(false)
  const [farms, setFarms] = useState<Farm[]>([])
  const [selected, setSelected] = useState<Farm>()
  const [listings, setListings] = useState<Listing[]>([])
  const [cart, setCart] = useState<Cart>()
  const [email, setEmail] = useState('client@example.test')
  const [tracking, setTracking] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = new URL(url).searchParams.get('token')
      if (token !== null) setTracking(token)
      setStatus('Retour du paiement reçu. Vérifiez le statut réel ci-dessous.')
    })
    return () => subscription.remove()
  }, [])
  const search = async () => {
    setError('')
    try {
      const result = await api.findNearbyFarms({
        latitude: 45.764,
        longitude: 4.8357,
        radiusKm: 100,
      })
      setFarms(result.farms)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recherche indisponible.')
    }
  }
  const openFarm = async (farm: Farm) => {
    setSelected(farm)
    const result = await api.getFarmListings(farm.id)
    setListings(result.listings)
  }
  const add = async (listingId: string) => {
    let current = cart
    if (current === undefined) current = await api.request<Cart>('/v1/carts', { method: 'POST' })
    setCart(
      await api.request(`/v1/carts/${current.cartId}/items`, {
        method: 'POST',
        body: { listingId, quantity: '1' },
      })
    )
  }
  const checkout = async () => {
    if (cart === undefined) return
    const result = await api.request<{ checkoutUrl: string; guestToken: string }>('/v1/checkout', {
      method: 'POST',
      headers: { 'idempotency-key': `${Date.now()}-mobile` },
      body: { cartId: cart.cartId, email },
    })
    setTracking(result.guestToken)
    await Linking.openURL(result.checkoutUrl)
  }
  const track = async () => {
    const order = await api.request<{ reference: string; status: string }>(
      `/v1/guest-orders/${tracking}`
    )
    setStatus(`${order.reference} · ${order.status}`)
  }
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>Marché local</Text>
        {!locationAllowed ? (
          <View style={styles.card}>
            <Text style={styles.title}>Produits autour de vous</Text>
            <Text>Votre position sert uniquement à classer les fermes proches.</Text>
            <Pressable
              style={styles.button}
              onPress={() => {
                setLocationAllowed(true)
                void search()
              }}
            >
              <Text style={styles.buttonText}>Autoriser la localisation</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Fermes proches</Text>
            {farms.map((farm) => (
              <Pressable key={farm.id} style={styles.card} onPress={() => void openFarm(farm)}>
                <Text style={styles.subtitle}>{farm.name}</Text>
                <Text>
                  {farm.city} · {farm.distanceKm.toFixed(1)} km
                </Text>
              </Pressable>
            ))}
            {selected !== undefined && (
              <View>
                <Text style={styles.title}>{selected.name}</Text>
                {listings.map((listing) => (
                  <View key={listing.id} style={styles.card}>
                    <Text style={styles.subtitle}>{listing.title}</Text>
                    <Text>
                      {(listing.priceCents / 100).toFixed(2)} € · {listing.availableQuantity}{' '}
                      disponible
                    </Text>
                    <Pressable style={styles.button} onPress={() => void add(listing.id)}>
                      <Text style={styles.buttonText}>Ajouter</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        {cart !== undefined && (
          <View style={styles.card}>
            <Text style={styles.title}>Panier · {(cart.totalCents / 100).toFixed(2)} €</Text>
            {cart.items.map((item) => (
              <Text key={item.id}>
                {item.title} × {item.quantity}
              </Text>
            ))}
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Pressable style={styles.button} onPress={() => void checkout()}>
              <Text style={styles.buttonText}>Payer dans le navigateur</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.title}>Suivi</Text>
          <TextInput
            style={styles.input}
            value={tracking}
            onChangeText={setTracking}
            placeholder="Jeton sécurisé"
          />
          <Pressable style={styles.button} onPress={() => void track()}>
            <Text style={styles.buttonText}>Actualiser</Text>
          </Pressable>
          <Text>{status}</Text>
        </View>
        {error !== '' && <Text accessibilityRole="alert">{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f1e7' },
  container: { padding: 20, gap: 14 },
  brand: { fontSize: 30, fontWeight: '700', color: '#245b36' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 17, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 8 },
  button: { backgroundColor: '#245b36', borderRadius: 9, padding: 12, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#9b9b8a', borderRadius: 8, padding: 10 },
})
