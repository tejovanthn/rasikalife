import { useDebounce } from '@uidotdev/usehooks';
import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

interface Entity {
  id: string;
  name: string;
}

// Single-select props
interface SingleSelectProps {
  multiple?: false;
  label: string;
  placeholder: string;
  searchUrl: string;
  value: Entity | null;
  onChange: (entity: Entity | null) => void;
  error?: string;
  inputId?: string;
  fieldName?: string;
}

// Multi-select props
interface MultiSelectProps {
  multiple: true;
  label: string;
  placeholder: string;
  searchUrl: string;
  value: Entity[];
  onChange: (entities: Entity[]) => void;
  error?: string;
  inputId?: string;
  fieldName?: string;
}

type SearchSelectProps = SingleSelectProps | MultiSelectProps;

export function SearchSelect(props: SearchSelectProps) {
  const {
    label,
    placeholder,
    searchUrl,
    value,
    onChange,
    error,
    inputId,
    fieldName,
    multiple = false,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(multiple ? '' : ((value as Entity | null)?.name ?? ''));
  const fetcher = useFetcher<Entity[]>();
  const debouncedQuery = useDebounce(query, 300);
  const inputIdOrDefault = inputId ?? `search-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const fieldNameOrDefault =
    fieldName ?? `${label.toLowerCase().replace(/\s+/g, '-')}_${multiple ? 'ids' : 'id'}`;
  const lastSearchedQuery = useRef<string>('');

  const results = fetcher.data ?? [];
  const isLoading = fetcher.state === 'loading';

  // Only search when debounced query changes and dropdown is open
  useEffect(() => {
    if (debouncedQuery.length >= 2 && isOpen && debouncedQuery !== lastSearchedQuery.current) {
      lastSearchedQuery.current = debouncedQuery;
      fetcher.load(`${searchUrl}?q=${encodeURIComponent(debouncedQuery)}`);
    }
    // fetcher.load is stable from useFetcher
  }, [debouncedQuery, isOpen, searchUrl, fetcher.load]);

  // Filter out already selected items in multi-select mode
  const availableResults = multiple
    ? results.filter(r => !(value as Entity[]).some(v => v.id === r.id))
    : results;

  const handleSelect = (entity: Entity) => {
    if (multiple) {
      (onChange as MultiSelectProps['onChange'])([...(value as Entity[]), entity]);
      setQuery('');
    } else {
      (onChange as SingleSelectProps['onChange'])(entity);
      setQuery(entity.name);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    if (!multiple) {
      (onChange as SingleSelectProps['onChange'])(null);
      setQuery('');
    }
  };

  const handleRemove = (entity: Entity) => {
    if (multiple) {
      (onChange as MultiSelectProps['onChange'])(
        (value as Entity[]).filter(v => v.id !== entity.id)
      );
    }
  };

  return (
    <div className={multiple ? 'space-y-2' : 'relative'}>
      <Label htmlFor={inputIdOrDefault}>{label}</Label>

      {/* Selected items display (multi-select only) */}
      {multiple && (value as Entity[]).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(value as Entity[]).map(entity => (
            <span
              key={entity.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded"
            >
              {entity.name}
              <button
                type="button"
                onClick={() => handleRemove(entity)}
                className="hover:text-destructive"
                aria-label={`Remove ${entity.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative mt-1">
        {!multiple && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <Input
          id={inputIdOrDefault}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            if (multiple) {
              // Delay closing to allow click on results
              setTimeout(() => setIsOpen(false), 200);
            }
          }}
          className={multiple ? 'pr-10' : 'pl-10 pr-10'}
        />
        {!multiple && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-8 flex items-center"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
        {isLoading && (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* No results message */}
      {isOpen &&
        query.length >= 2 &&
        availableResults.length === 0 &&
        !isLoading &&
        fetcher.data && (
          <div className="absolute z-10 w-full mt-1 py-2 px-3 bg-popover border rounded-md shadow-lg text-sm text-muted-foreground">
            No results found
          </div>
        )}

      {/* Results dropdown */}
      {isOpen && availableResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 py-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {availableResults.map(entity => (
            <button
              key={entity.id}
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-accent focus:bg-accent outline-none"
              onClick={() => handleSelect(entity)}
            >
              {entity.name}
            </button>
          ))}
        </div>
      )}

      {/* Hidden inputs for form submission */}
      {multiple
        ? (value as Entity[]).map((entity, index) => (
            <input
              key={entity.id}
              type="hidden"
              name={`${fieldNameOrDefault}[${index}]`}
              value={entity.id}
            />
          ))
        : value && <input type="hidden" name={fieldNameOrDefault} value={(value as Entity).id} />}

      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
