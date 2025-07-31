import { searchConfigs } from '~/lib/searchConfig';
// New GlobalSearch component using UnifiedSearch
import { UnifiedSearch } from './shared/UnifiedSearch';

export function GlobalSearchNew() {
  const config = searchConfigs.globalInstant();

  return <UnifiedSearch config={config} />;
}
