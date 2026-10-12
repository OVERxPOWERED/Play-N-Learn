```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Player } from '@/src/domain'

interface UsePlayerReturn {
  player: Player | null
  isLoading: boolean
  error: Error | null
  mutate: (data?: Player | ((current: Player | null) => Player | null), options?: { revalidate?: boolean }) => Promise<Player | null>
}

interface UsePlayersReturn {
  players: Player[]
  isLoading: boolean
  error: Error | null
  mutate: (data?: Player[] | ((current: Player[]) => Player[]), options?: { revalidate?: boolean }) => Promise<Player[]>
}

interface MutationOptions {
  revalidate?: boolean
  optimisticData?: Player | Player[]
  rollbackOnError?: boolean
}

const CACHE_KEY = 'players_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// In-memory cache with timestamps
const cache = new Map<string, { data: unknown; timestamp: number }>()
const pendingMutations = new Map<string, Promise<unknown>>()

function getCacheKey(key: string): string {
  return `${CACHE_KEY}:${key}`
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const session = await getSession()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }
  return fetch(url, { ...options, headers })
}

async function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/auth/session')
    if (res.ok) return res.json()
  } catch {
    // Session not available
  }
  return null
}

function readCache<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function writeCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key)
    }
  }
}

export function usePlayer(id: string | null): UsePlayerReturn {
  const [player, setPlayer] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMounted = useRef(true)
  const fetcherRef = useRef<AbortController | null>(null)

  const fetchPlayer = useCallback(async (playerId: string) => {
    if (fetcherRef.current) {
      fetcherRef.current.abort()
    }
    fetcherRef.current = new AbortController()

    const cacheKey = getCacheKey(`player:${playerId}`)
    const cached = readCache<Player>(cacheKey)
    if (cached) {
      if (isMounted.current) {
        setPlayer(cached)
        setIsLoading(false)
        setError(null)
      }
      return cached
    }

    if (isMounted.current) setIsLoading(true)

    try {
      const res = await fetchWithAuth(`/api/players/${playerId}`, {
        signal: fetcherRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch player: ${res.statusText}`)
      }

      const data: Player = await res.json()
      writeCache(cacheKey, data)

      if (isMounted.current) {
        setPlayer(data)
        setError(null)
      }
      return data
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setPlayer(null)
      }
      throw err
    } finally {
      if (isMounted.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    if (id) {
      fetchPlayer(id)
    } else {
      setPlayer(null)
      setIsLoading(false)
    }
    return () => {
      isMounted.current = false
      if (fetcherRef.current) {
        fetcherRef.current.abort()
      }
    }
  }, [id, fetchPlayer])

  const mutate = useCallback(async (
    data?: Player | ((current: Player | null) => Player | null),
    options: MutationOptions = {}
  ): Promise<Player | null> => {
    const { revalidate = true, optimisticData, rollbackOnError = true } = options
    const playerId = id
    if (!playerId) return null

    const cacheKey = getCacheKey(`player:${playerId}`)
    const previousData = readCache<Player>(cacheKey) ?? player

    // Optimistic update
    let optimisticValue: Player | null = null
    if (typeof data === 'function') {
      optimisticValue = data(previousData)
    } else if (data !== undefined) {
      optimisticValue = data
    } else if (optimisticData) {
      optimisticValue = optimisticData
    }

    if (optimisticValue !== null) {
      writeCache(cacheKey, optimisticValue)
      setPlayer(optimisticValue)
    }

    // If no actual data provided, just return optimistic
    if (data === undefined && !optimisticData) {
      if (revalidate) {
        return fetchPlayer(playerId)
      }
      return optimisticValue
    }

    // Perform actual mutation
    const mutationKey = `mutate:player:${playerId}`
    const mutationPromise = (async () => {
      try {
        const method = optimisticValue?.id ? 'PUT' : 'POST'
        const url = optimisticValue?.id ? `/api/players/${optimisticValue.id}` : '/api/players'
        const body = optimisticValue ?? (typeof data === 'function' ? data(previousData) : data)

        const res = await fetchWithAuth(url, {
          method,
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          throw new Error(`Mutation failed: ${res.statusText}`)
        }

        const result: Player = await res.json()
        writeCache(cacheKey, result)
        invalidateCache('players:list')
        
        if (isMounted.current) {
          setPlayer(result)
        }
        return result
      } catch (err) {
        if (rollbackOnError) {
          writeCache(cacheKey, previousData)
          setPlayer(previousData)
        }
        throw err
      } finally {
        pendingMutations.delete(mutationKey)
        if (revalidate) {
          fetchPlayer(playerId)
        }
      }
    })()

    pendingMutations.set(mutationKey, mutationPromise)
    return mutationPromise
  }, [id, player, fetchPlayer])

  return { player, isLoading, error,