import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to get response text first (works for both JSON and plain text)
    const responseText = await res.text();
    
    try {
      // Try to parse as JSON
      const errorData = JSON.parse(responseText);
      const errorMessage = errorData.error || res.statusText;
      throw new Error(errorMessage);
    } catch {
      // If JSON parsing fails, use the raw text or status
      throw new Error(responseText || res.statusText);
    }
  }
}

export async function apiRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<Response> {
  const { method = "GET", body } = options;
  
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: typeof body === 'string' ? body : (body ? JSON.stringify(body) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
