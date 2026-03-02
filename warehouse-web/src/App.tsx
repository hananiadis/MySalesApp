import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppRouter from './routes/AppRouter';

// Configure React Query with persistent caching - data never auto-refreshes
// All data persists in cache and only updates via manual refresh button
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Data never goes stale - always use cache
      cacheTime: Infinity, // Keep data in memory forever
      refetchOnWindowFocus: false, // Never refetch when window regains focus
      refetchOnMount: false, // Never refetch on component mount
      refetchOnReconnect: false, // Never refetch on reconnect
      retry: 1, // Only retry once on failure
    },
  },
});

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <AppRouter />
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
