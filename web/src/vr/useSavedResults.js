// useSavedResults.js — the single read-only data layer for QURE Lab.
//
// Loads the precomputed JSON (index + one patient + that patient's volume),
// snaps a requested noise level to the nearest SAVED run, and surfaces the
// trust verdict. HARD RULE (SPEC): no number shown in the headset may be
// invented. Everything here is read straight from web/public/data/.
//
// Trust verdict note: the SPEC text claims the patient JSON has no per-run
// `trust` field and tells us to apply index.json.trust_rule. In the ACTUAL
// frozen data every run DOES carry `trust` and `trust_mitigated`
// (precomputed offline). We therefore use those saved values directly and
// only fall back to applying `trust_rule` if a run is ever missing them; if
// neither is available we return a clearly-labelled placeholder and warn in
// the console. We never invent a verdict.

import { useCallback, useEffect, useMemo, useState } from 'react'

const BASE = import.meta.env.BASE_URL || '/'
const DATA = `${BASE}data`

async function getJSON(url) {
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return res.json()
}

async function getBin(url) {
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

// Snap a requested noise value to the index of the nearest saved noise level.
export function snapNoiseIndex(levels, requested) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < levels.length; i++) {
    const d = Math.abs(levels[i] - requested)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

// Apply index.json.trust_rule as a *documented* fallback/cross-check.
// The rule string in the frozen data is:
//   "refer if the 0.5-thresholded label differs from the ideal label or
//    |p-0.5| < 0.03; trust if |p-0.5| >= 0.10; otherwise caution"
// This is NOT an invented rule — it is the rule the data author recorded.
export function applyTrustRule(p, pIdeal) {
  if (p == null || pIdeal == null) return null
  const label = p >= 0.5 ? 1 : 0
  const idealLabel = pIdeal >= 0.5 ? 1 : 0
  const margin = Math.abs(p - 0.5)
  if (label !== idealLabel || margin < 0.03) return 'refer'
  if (margin >= 0.1) return 'trust'
  return 'caution'
}

// Resolve the verdict for a run. Prefer the saved field; else the documented
// rule; else a flagged placeholder. `which` is 'noisy' or 'mitigated'.
export function resolveTrust(run, which = 'noisy') {
  const savedKey = which === 'mitigated' ? 'trust_mitigated' : 'trust'
  if (run && typeof run[savedKey] === 'string') {
    return { verdict: run[savedKey], source: 'saved' }
  }
  const p = which === 'mitigated' ? run?.p_malignant?.mitigated : run?.p_malignant?.noisy
  const pIdeal = run?.p_malignant?.ideal
  const computed = applyTrustRule(p, pIdeal)
  if (computed) {
    console.warn(
      `[QURE] run missing "${savedKey}"; applied documented index.json.trust_rule → ${computed}`
    )
    return { verdict: computed, source: 'rule' }
  }
  console.warn(`[QURE] no saved "${savedKey}" and trust_rule unavailable; showing placeholder`)
  return { verdict: 'n/a', source: 'placeholder' }
}

// Main hook. Manages the current patient + noise selection, loads everything,
// and exposes the snapped current run.
export function useSavedResults(initialPatientId = null) {
  const [index, setIndex] = useState(null)
  const [patientId, setPatientId] = useState(initialPatientId)
  const [patient, setPatient] = useState(null)
  const [volume, setVolume] = useState(null) // Uint8Array 28^3
  const [noiseIndex, setNoiseIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load index.json once.
  useEffect(() => {
    let alive = true
    getJSON(`${DATA}/index.json`)
      .then((idx) => {
        if (!alive) return
        setIndex(idx)
        setPatientId((cur) => cur ?? idx.patients?.[0] ?? null)
      })
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  // Load the selected patient JSON + its volume when the id changes.
  useEffect(() => {
    if (!patientId) return
    let alive = true
    setLoading(true)
    Promise.all([
      getJSON(`${DATA}/patients/${patientId}.json`),
      getBin(`${DATA}/volumes/${patientId}.bin`),
    ])
      .then(([pj, vol]) => {
        if (!alive) return
        setPatient(pj)
        setVolume(vol)
        setLoading(false)
      })
      .catch((e) => {
        if (!alive) return
        setError(e)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [patientId])

  const noiseLevels = index?.noise_p2 ?? []

  // Clamp noiseIndex into range whenever levels change.
  useEffect(() => {
    if (noiseLevels.length && noiseIndex > noiseLevels.length - 1) {
      setNoiseIndex(noiseLevels.length - 1)
    }
  }, [noiseLevels.length, noiseIndex])

  // Current run = the patient run whose noise_p2 matches the selected index,
  // matched by value against the saved levels so the shown value is always a
  // real saved run.
  const run = useMemo(() => {
    if (!patient?.runs?.length) return null
    const level = noiseLevels[noiseIndex]
    if (level == null) return patient.runs[0]
    // find the run with the matching (snapped) noise_p2
    let best = patient.runs[0]
    let bestD = Infinity
    for (const r of patient.runs) {
      const d = Math.abs((r.noise_p2 ?? 0) - level)
      if (d < bestD) {
        bestD = d
        best = r
      }
    }
    return best
  }, [patient, noiseLevels, noiseIndex])

  // Snap a requested raw noise value and update the selection.
  const setNoiseByValue = useCallback(
    (value) => {
      if (!noiseLevels.length) return
      setNoiseIndex(snapNoiseIndex(noiseLevels, value))
    },
    [noiseLevels]
  )

  return {
    loading,
    error,
    index,
    model: index?.model ?? null,
    trustRule: index?.trust_rule ?? null,
    patients: index?.patients ?? [],
    patientId,
    setPatientId,
    patient,
    volume,
    noiseLevels,
    noiseIndex,
    setNoiseIndex,
    setNoiseByValue,
    noiseValue: noiseLevels[noiseIndex] ?? 0,
    run,
  }
}
