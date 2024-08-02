export const getSongSlug = (song: { id: string; name: string }) => {
  return `${song.name.toLowerCase().replace(/ /g, '-')}-${song.id}`;
};
