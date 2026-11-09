import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> = {
  data: T | null
  error: unknown
  loading: boolean
  reload: () => void
}

/**
 * Small fetch helper for read-only API calls. `loader` must be stable
 * (wrap it with `useCallback`) and `deps` controls when it re-runs.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let active = true
    setLoading(true)
    run()
      .then((value) => {
        if (!active) return
        setData(value)
        setError(null)
      })
      .catch((reason) => {
        if (!active) return
        setError(reason)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [run, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  return { data, error, loading, reload }
}
