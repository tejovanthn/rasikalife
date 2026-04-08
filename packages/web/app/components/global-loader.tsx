import { useNavigation } from 'react-router';

export function GlobalLoader() {
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-[100] overflow-hidden">
      <div className="h-full bg-primary origin-left animate-page-progress" />
    </div>
  );
}
