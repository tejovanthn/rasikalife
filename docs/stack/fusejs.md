# Fuse.js

*Source: https://fusejs.io/*
*Version: Latest (v7+)*
*Last Updated: January 2025*

## Overview

Fuse.js is a powerful, lightweight fuzzy-search library with zero dependencies. It enables approximate string matching, typo tolerance, and intelligent result scoring. Can be used client-side or server-side (no DOM dependencies).

## Installation

```bash
npm install fuse.js
```

## Basic Usage

```typescript
import Fuse from 'fuse.js';

const books = [
  { title: "Old Man's War", author: { firstName: 'John', lastName: 'Scalzi' } },
  { title: 'The Lock Artist', author: { firstName: 'Steve', lastName: 'Hamilton' } }
];

const fuse = new Fuse(books, {
  keys: ['title', 'author.firstName']
});

const results = fuse.search('jon');
// Output: [{ item: {...}, refIndex: 0 }]
```

## Key Configuration Options

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `keys` | `Array` | `[]` | Keys to search; supports nested paths and weighted search |
| `isCaseSensitive` | `boolean` | `false` | Whether comparisons are case sensitive |
| `ignoreDiacritics` | `boolean` | `false` | Whether to ignore accents |
| `includeScore` | `boolean` | `false` | Include relevance score (0 = perfect match, 1 = complete mismatch) |
| `includeMatches` | `boolean` | `false` | Include matched character indices for highlighting |
| `minMatchCharLength` | `number` | `1` | Minimum match length to return |
| `shouldSort` | `boolean` | `true` | Sort results by score |
| `findAllMatches` | `boolean` | `false` | Continue matching after perfect match found |

### Fuzzy Matching Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `0.6` | Match tolerance (0.0 = exact only, 1.0 = match anything) |
| `location` | `number` | `0` | Approximate pattern location in text |
| `distance` | `number` | `100` | How close match must be to `location` |
| `ignoreLocation` | `boolean` | `false` | Ignore location entirely; match anywhere in string |

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useExtendedSearch` | `boolean` | `false` | Enable unix-like search commands |
| `ignoreFieldNorm` | `boolean` | `false` | Ignore field-length normalization in scoring |
| `fieldNormWeight` | `number` | `1` | Adjust field-length norm impact (0 = ignore, 2 = amplify) |

## Search Scores and Highlights

### Getting Scores

```typescript
const fuse = new Fuse(books, {
  keys: ['title', 'author.firstName'],
  includeScore: true
});

const results = fuse.search('jon');
// results[0].score = 0.xx (lower is better)
```

### Getting Matches for Highlighting

```typescript
const fuse = new Fuse(books, {
  keys: ['title'],
  includeMatches: true
});

const results = fuse.search('old');
// results[0].matches = [{ key: 'title', indices: [[0, 2]], value: "Old Man's War" }]
```

### Highlighting Helper Pattern

```typescript
function highlightMatch(text: string, indices: [number, number][]) {
  let lastIndex = 0;
  const parts = [];

  for (const [start, end] of indices) {
    parts.push(text.slice(lastIndex, start));
    parts.push(`<mark>${text.slice(start, end + 1)}</mark>`);
    lastIndex = end + 1;
  }
  parts.push(text.slice(lastIndex));

  return parts.join('');
}
```

## Weighted Multi-Field Search

```typescript
const options = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'artist.name', weight: 0.2 },
    { name: 'traditions', weight: 0.1 }
  ],
  threshold: 0.3
};

const fuse = new Fuse(artists, options);
```

## Performance for Medium-Sized Datasets (10k-100k)

### Benchmark Insights

| Dataset Size | Query Time (approx) | Recommendation |
|--------------|---------------------|----------------|
| 10,000 items | ~50-100ms | Client-side acceptable |
| 50,000 items | ~200-400ms | Consider debouncing |
| 100,000 items | ~500ms-1s | Use pre-built index, consider hybrid approach |

### Performance Optimization Strategies

**Pre-built Index (Critical for large datasets)**

```typescript
// Build step: Pre-generate index
import Fuse from 'fuse.js';
const myIndex = Fuse.createIndex(['title', 'name'], artists);
fs.writeFileSync('fuse-index.json', JSON.stringify(myIndex.toJSON()));

// Runtime: Load pre-built index
import Fuse from 'fuse.js';
const fuseIndex = Fuse.parseIndex(require('./fuse-index.json'));
const fuse = new Fuse(artists, options, fuseIndex);
```

**Use `limit` option**

```typescript
const results = fuse.search('query', { limit: 10 });
```

### Memory Considerations

- Fuse.js loads entire dataset into memory
- For 100k items with 3 keys: ~25-50MB memory usage
- Consider chunked loading for very large datasets

## Best Practices for Search Keys

```typescript
// Flattened, normalized fields for search
{
  searchName: 'M.S. Subbulakshmi',
  searchTradition: 'carnatic',
  searchType: 'vocalist'
}

// Nested paths work too
keys: ['name', 'metadata.traditions', 'profile.bio']

// Array of strings can be searched
{
  name: 'Artist',
  tags: ['carnatic', 'vocalist', 'traditional']
}
// keys: ['name', 'tags'] will search within arrays
```

## Gotchas and Best Practices

1. **Threshold tuning**: Start at 0.6, adjust based on desired fuzziness
2. **Key order matters**: Earlier keys get slight preference in scoring
3. **Pre-build index for datasets >10k**: Significant startup time savings
4. **Long queries slow search**: Keep queries short (<20 chars) for performance
5. **Memory vs speed tradeoff**: Larger threshold = more computation
6. **Use `ignoreDiacritics: true`** for Indian music names with diacritics
