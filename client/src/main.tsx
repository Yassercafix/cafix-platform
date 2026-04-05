import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import App from "./App";
import { TranslationProvider } from "./locales/useTranslation";
import { trpc } from "./lib/trpc";
import "./index.css";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Always include cookies so the backend can read app_session_id
        const sessionToken =
          typeof window !== "undefined"
            ? localStorage.getItem("session_token")
            : null;
        const headers = new Headers(init?.headers);
        if (sessionToken) {
          headers.set("Authorization", `Bearer ${sessionToken}`);
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <App />
      </TranslationProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
