import { Form, useSearchParams, useSubmit } from 'react-router';
import { Filter, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useHydrated } from '~/lib/progressive-enhancement';

interface SearchFilters {
  query?: string;
  type?: 'all' | 'compositions' | 'artists' | 'ragas' | 'talas';
  tradition?: string;
  language?: string;
  melakarta?: string;
  aksharas?: string;
  artistType?: string;
}

export function AdvancedSearch() {
  const [searchParams] = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isHydrated = useHydrated();
  const submit = useSubmit();

  const currentFilters: SearchFilters = {
    query: searchParams.get('q') || '',
    type: (searchParams.get('type') as SearchFilters['type']) || 'all',
    tradition: searchParams.get('tradition') || '',
    language: searchParams.get('language') || '',
    melakarta: searchParams.get('melakarta') || '',
    aksharas: searchParams.get('aksharas') || '',
    artistType: searchParams.get('artistType') || '',
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (value && value !== 'all') {
        params.set(key, value.toString());
      }
    }

    submit(params, { method: 'get', action: '/carnatic/search' });
  };

  const clearFilters = () => {
    submit(new URLSearchParams({ q: currentFilters.query || '' }), {
      method: 'get',
      action: '/carnatic/search',
    });
  };

  const hasActiveFilters = Object.entries(currentFilters).some(
    ([key, value]) => key !== 'query' && key !== 'type' && value
  );

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-8">
      <Form method="get" onSubmit={isHydrated ? handleSubmit : undefined} action="/carnatic/search">
        {/* Main Search */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                name="q"
                placeholder="Search compositions, artists, ragas, talas..."
                defaultValue={currentFilters.query}
                className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
              />
            </div>
          </div>

          {isHydrated && (
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-4 py-3 border rounded-lg transition-colors flex items-center gap-2 ${
                showAdvanced || hasActiveFilters
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-input text-muted-foreground hover:bg-accent'
              }`}
            >
              <Filter size={16} />
              Filters
              {hasActiveFilters && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-1">
                  Active
                </span>
              )}
            </button>
          )}

          <button
            type="submit"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Search
          </button>
        </div>

        {/* Content Type Filter */}
        <div className="mb-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'All' },
              { value: 'compositions', label: 'Compositions' },
              { value: 'artists', label: 'Artists' },
              { value: 'ragas', label: 'Ragas' },
              { value: 'talas', label: 'Talas' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value={value}
                  defaultChecked={currentFilters.type === value}
                  className="sr-only peer"
                />
                <div className="px-4 py-2 border border-input rounded-full cursor-pointer text-sm transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary hover:bg-accent">
                  {label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        {(showAdvanced || !isHydrated) && (
          <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Advanced Filters</h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
                >
                  <X size={14} />
                  Clear Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tradition */}
              <div>
                <label
                  htmlFor="tradition"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Tradition
                </label>
                <select
                  id="tradition"
                  name="tradition"
                  defaultValue={currentFilters.tradition}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                >
                  <option value="">Any Tradition</option>
                  <option value="CARNATIC">Carnatic</option>
                  <option value="HINDUSTANI">Hindustani</option>
                  <option value="FOLK">Folk</option>
                  <option value="DEVOTIONAL">Devotional</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label
                  htmlFor="language"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Language
                </label>
                <select
                  id="language"
                  name="language"
                  defaultValue={currentFilters.language}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                >
                  <option value="">Any Language</option>
                  <option value="telugu">Telugu</option>
                  <option value="tamil">Tamil</option>
                  <option value="kannada">Kannada</option>
                  <option value="sanskrit">Sanskrit</option>
                  <option value="malayalam">Malayalam</option>
                  <option value="hindi">Hindi</option>
                </select>
              </div>

              {/* Artist Type */}
              <div>
                <label
                  htmlFor="artistType"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Artist Type
                </label>
                <select
                  id="artistType"
                  name="artistType"
                  defaultValue={currentFilters.artistType}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                >
                  <option value="">Any Type</option>
                  <option value="COMPOSER">Composer</option>
                  <option value="VOCALIST">Vocalist</option>
                  <option value="INSTRUMENTALIST">Instrumentalist</option>
                  <option value="PERCUSSIONIST">Percussionist</option>
                  <option value="MUSICOLOGIST">Musicologist</option>
                </select>
              </div>

              {/* Melakarta (for Ragas) */}
              <div>
                <label
                  htmlFor="melakarta"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Melakarta Number
                </label>
                <input
                  type="number"
                  id="melakarta"
                  name="melakarta"
                  min="1"
                  max="72"
                  placeholder="1-72"
                  defaultValue={currentFilters.melakarta}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                />
              </div>

              {/* Aksharas (for Talas) */}
              <div>
                <label
                  htmlFor="aksharas"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Aksharas (Beats)
                </label>
                <select
                  id="aksharas"
                  name="aksharas"
                  defaultValue={currentFilters.aksharas}
                  className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                >
                  <option value="">Any Count</option>
                  <option value="3">3 Aksharas</option>
                  <option value="4">4 Aksharas</option>
                  <option value="5">5 Aksharas</option>
                  <option value="6">6 Aksharas</option>
                  <option value="7">7 Aksharas</option>
                  <option value="8">8 Aksharas</option>
                  <option value="9">9 Aksharas</option>
                  <option value="10">10 Aksharas</option>
                  <option value="14">14 Aksharas</option>
                  <option value="16">16 Aksharas</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
}
