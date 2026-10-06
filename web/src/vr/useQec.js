// useQec.js — read-only loader for web/public/data/qec.json (the saved
// 3-qubit repetition-code results). Mirrors useSavedResults: fetch once, no
// backend, no computation beyond grouping saved rows. Returns
// { qec, error } where qec is the parsed JSON or null while loading.

import { useEffect, useState } from 'react'

const BASE = import.meta.env.BASE_URL || '/'

export function useQec() {
  const [qec, setQec] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let alive = true
    fetch(`${BASE}data/qec.json`, { cache: 'force-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load qec.json: ${r.status}`)
        return r.json()
      })
      .then((j) => alive && setQec(j))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])
  return { qec, error }
}
