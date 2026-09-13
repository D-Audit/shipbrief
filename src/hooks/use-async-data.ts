"use client";

import { useCallback, useEffect, useState } from "react";
import type { AsyncState } from "@/types";

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle" });

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await fetcher();
      if (Array.isArray(data) && data.length === 0) {
        setState({ status: "empty" });
      } else {
        setState({ status: "success", data });
      }
    } catch (e) {
      setState({
        status: "error",
        error: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  }, [fetcher]);

  useEffect(() => {
    let active = true;

    async function run() {
      setState({ status: "loading" });
      try {
        const data = await fetcher();
        if (!active) return;
        if (Array.isArray(data) && data.length === 0) {
          setState({ status: "empty" });
        } else {
          setState({ status: "success", data });
        }
      } catch (e) {
        if (!active) return;
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "Something went wrong",
        });
      }
    }

    void run();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { state, reload };
}
