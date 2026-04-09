import { useNavigation } from 'react-router';

export function GlobalLoader() {
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';

  if (!isLoading) return null;

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        Loading page
      </span>
      <div className="fixed top-0 left-0 right-0 h-0.5 z-[100] overflow-hidden" aria-hidden="true">
        <div className="h-full bg-primary origin-left animate-page-progress" />
      </div>
    </>
  );
}
