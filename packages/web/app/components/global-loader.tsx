import { useNavigation } from 'react-router';

export function GlobalLoader() {
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-orange-200 dark:bg-orange-900 z-50">
      <div className="h-full bg-orange-500 animate-pulse" />
    </div>
  );
}
