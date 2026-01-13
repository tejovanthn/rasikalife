import { Artist } from '@rasika/core';

console.log('CreateArtistSchema:', Artist.CreateArtistSchema);
console.log('Type of CreateArtistSchema:', typeof Artist.CreateArtistSchema);
console.log('Has parse method:', typeof Artist.CreateArtistSchema?.parse);
console.log('Schema shape:', Artist.CreateArtistSchema?.shape);
