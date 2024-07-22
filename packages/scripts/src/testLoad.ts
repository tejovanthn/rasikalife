import { addSong, getSongByName } from '@rasika/core/db';

const data = [
  {
    id: 'c0000.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'aadip-paramporuLin',
    raga: ['aabhOgi'],
    lyrics:
      '1\n\n Adip-paramporuLin Ukkam adai annaiyenap-paNidal Akkam\nshUdillai kANuminda nATTil maTra tollai madangaL sheyyum dukkham\n\n\n2\n\n mUlappazham poruLin nATTam inda mUnru bhuviyin adan ATTam\nkAlap-perungaLattin mIdE engaL kaLi naTamulagak-kUTTam\n\n\n3\n\n kAlai iLa veyilin kATSi avan kaNNoLi kATTuginra mATSi\nnIla vishumbiniDai yiravir shuDar nEmiyanaittum avalATSi\n\n\n4\n\n nAranNanenru pazha vEdam shollum nAyakan shakti tiruppAdam\nshErat-tavam purindu peruvAr ingu shelvam arivu shiva bOdham\n\n\n5\n\n Adi shivanuDaiya shakti engaL annaiyaruL perudal mukti\nmIdiyilirukkum pOdE adai vellal sukhattinukku yukti\n\n\n6\n\n paNDai vidhiyuDaiya dEvi veLLai bhArati annai aruL mEvi\nkaNDa poruL viLakkum nUlgaL pala kaTralillAdavanO pAvi\n\n\n7\n\n mUrtigaL mUnru poruLonru anda mUlap-poruL oLiyin rAnru\nnErti tigazhum anda oLiyai enda nEramum poruttu shaktiyenru\n\n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
];

addSong({
  ...data[0],
  name: data[0].title,
  slug: data[0].title.toLowerCase().replace(/ /g, '-'),
  raga: data[0].raga.join(','),
  source: 'karnatik.com',
});

getSongByName('aadip-paramporuLin').then(console.log);
