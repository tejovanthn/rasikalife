import { searchConfigs } from '~/lib/searchConfig';
// New AdvancedSearch component using UnifiedSearch
import { UnifiedSearch } from './shared/UnifiedSearch';

export function AdvancedSearchNew() {
  const config = searchConfigs.globalAdvanced();

  return <UnifiedSearch config={config} />;
}
