import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from './api';

let metaCache = null;

export function useMeta() {
  const [meta, setMeta] = useState(metaCache);
  useEffect(() => {
    if (!metaCache) api.get('/meta').then((r) => setMeta((metaCache = r.data)));
  }, []);
  return meta;
}

/** Fetch a URL, optionally re-polling (live status). */
export function useFetch(url, { poll } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const r = await api.get(url);
      setData(r.data);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
    if (!poll) return;
    const id = setInterval(reload, poll);
    return () => clearInterval(id);
  }, [reload, poll]);

  return { data, error, loading, reload, setData };
}

/** Re-render every `ms` (for countdowns). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

