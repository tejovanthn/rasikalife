export interface Song {
  id: string;
  tala?: string;
  composer?: string;
  language?: string;
  updated?: string;
  title: string;
  raga: Array<string>;
  lyrics: string;
  meaning?: string;
  notation?: string;
  otherInfo?: string;
  source?: string;
}

export const allData = [
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
  {
    id: 'c0001.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'aanmaavaana gaNapatiyin',
    raga: ['hamsadwani'],
    lyrics:
      'pallavi\n\n AnmAvana gaNapatiyin aruLUNDu accam illaiyE\n\nanupallavi\n\n mEnmaippaDuvAi manamE kEL viNNin iDi mun vizhundAlum\n\ncaraNam\n\n pANmai tavari naDungAdE bhayattAl Edum payanillai\nYAn mun uraittEn kOTi murai innum kOTi murai sholvEn\n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0002.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'bhaktiyinaalE',
    raga: ['kaambhOji'],
    lyrics:
      'pallavi\n\n bhaktiyinAlE (nalla) (deiva) inda pArinil EidiDum mEnmaigaL\n kELaDi cittam teLiyum ingu sheigai anaittilum shemmai pirandiDum\n\n\nanupallavi\n\n viddaigaL shErum nalla vIrar uravu kiDaikkum manattiDai\n tattuvam uNDAm nenjil sancalam nIngi urudi vinaindiDum\n\n\ncaraNam 1\n\n kAmap-pishAshai kudikkAl koNDaDittu vizhuttiDa enrum it-\ntAmasa pEyaik-kaNDu tAkki maDittiDalAgum ennEramum\n tImaiyai eNNi anjun-tEmparp-pishAshai t-tirugi erindu poin-\nnAmamillAdE uNmai nAmattinAl ingu nanmai viLaindiDum\n\n\n\n2\n\n Ashaiyaik-kolvOm pulai accakattaik-konru poshukkiDuvOm keTTa\npAshamaruppOm ingup-pArvati shakti viLangudal kaNDadai\nmOsham sheyyAmal uNmai muTrilum kaNDu vaNangi vaNangiyOr\nIshanaip-pOTri inbam yAvaiyum uNDu pugazh koNDu vAzhguvam\n\n\n\n3\n\n shOrvugaL pOghum poi sukhattinait-taLLi sukham peralAgum nar-\npArvaigaL tOnrum miDippAmbu kaDitta viSam aghanrE nalla\nsErvaigaL shErum pala shelvangaL vandu magizhcci viLaindiDum\ntIrvaigaL tIrum piNi tIrum pala pala inbangaL sherndiDum\n\n\n\n4\n\n kalvi vaLarum pala kAryam kaiyurum vIriyam OngiDum\nalla mozhiyum nalla Anmai uNDAgum arivu teLindiDum\nsholluvadellAm marai shollinaip-pOlap-payanuLadAgum mei\nvallamai tOnrum deiva vAzhkkaiyTrEyingu vAzhttiDalAm uNmai\n\n\n\n5\n\n shOmba vazhiyum uDal shonna paDikku naDakkum muDi shaTrum\nkUmbudalinri nalla gOpuram pOla nimirnda nilai perum\nvImbugaL pOgum nalla mEnmaiyuNDAgi bhuyangaL parukkum poip-\npAmbu maDiyum meip-param venru nalla nerigaL unDAi viDum\n\n\n\n6\n\n santati vAzhum verum sancalam kETTu valimaigaL shErndiDum\ninda bhuvikkE ingOr Ishan uNDAyin arikkayiTTEn unran\nkanda malar tAL tuNai kAdal maghavu vaLarttiDa vENdum en\ncintaiyarindE aruL sheidiDa enrAl aruLeidiDum\n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0003.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'bhaarata dEsham',
    raga: ['punnaagavaraaLi'],
    lyrics:
      'pallavi\n\n bhArata dEshamenru peyar sholluvAr miDi bhayam kolluvAr tuyar paghai velluvAr\n\ncaraNam 1\n\n veLLIp-pani malaiyin mIdulavuvOm aDimElaik-kaDal muzhudum kappal viDuvOm\npallit-talamanaittum kOyil sheiguvOm engaL bhArata dEshamenru tOL koTTuvOm\n\n   \ncaraNam 2\n\n shingaLat-tIvinukkOr pAlam amaippOm sEtuvai mEDurutti vIdi shamaippOm\nvangattil ODi varum nIrin mighaiyAl mayandu nADugaLIL payir sheiguvOm\n\n   \ncaraNam 3\n\n veTTuk-kanigaL sheidu tangam mudalAm vEru pala poruLum kuDaindeDuppOm\neTTu dishaigaLilum sherivai viTRE eNNum poruLanaittum koNDu varuvOm\n\n   \ncaraNam 4\n\n muttuk-kuLippadoru ten kaDalilE moittu vaNikar pala nATTinar vandE\nnatti namakkiniya poruL koNarndu nammaruL vENDuvadu mErkkaraiyilE\n\n   \ncaraNam 5\n\n sindhu nadiyinmishai nilavinilE shEranan nAttinam peNgaLuDanE\nsundarat-telunginil pATTishaittu dONIgalOTTi viLayADi varuvOm \n\n   \ncaraNam 6\n\n gangai nadi purattu gOdumaip-paNDam kAviri veTrilaikku mAru koLLuvOm\nsingha marATTiyar tam kavitai koNDu shErattu dantangaL parishaLippOm\n\n   \ncaraNam 8\n\n Kashi nagar pulavar pEshum urai tAn kAnciyil kETpadarkkOr karuvi sheivOm\nrAshapurattAnattu vIrar tamakku nalliark-kannaDattut-tangam aLippOm\n\n    \ncaraNam 9\n\n Ayudam sheivOm nalla kAgidam sheivOm Alaigal vaippOm kalvi shAlaigaL vaippOm\nOidal sheyyOm talai shAyudal sheyyOm uNmaigaL sholvOm pala vaNmaigaL sheivOm\n\n  \ncaraNam 10\n\n kuDaigal sheivOm uzhu paDaigaL sheivOm kONigaL sheivOm irumbANigal sheivOm\nnaDaiyum parappumuNar vaNDigaL sheivOm jnAlam naDungavarum kappalgaL shivOm\n\n  \ncaraNam 11\n\n mantiram karppOm vinai tantiram karppOm vAnai alappOm kaDal mInaiyanappOm\n candra maNDalattil kaNDu teLivOm shandi nerupperukkum shAttiram karppOm\n\n  \ncaraNam 12\n\n kAviyam sheivOm nalla kADu vaLarppOm kalai vaLarppOm kolla kulai vaLarppOm\nOviyam sheivOm nalla UshigaL sheivOm ulaga tozhilanaittum uvandu sheivOm\n\n  \ncaraNam 13\n\n jAti iraNDozhiya vErillai enrE tamizh maghal sholliya shol amizhdamenpOl\nnIti neriyininru pirakkudavum tErmaiyar mElavar kIzhavar maTrOr\n\n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0004.shtml',
    tala: 'Tisram',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'bhaarata samudaayam',
    raga: ['yamunaa kalyaaNi', 'behaag'],
    lyrics:
      'bhArata samudAyam vAzhgavE  vAzhga vAzhga bhArata samudAyam vAzhgavE jaya jaya jaya\nanupallavi\n\n muppadu kOTi janangaLin sanga muzhumaikkumpOdu uDamai\n oppilAda samudAyam ulagattirkk-oru pudumai vAzhga\n\ncaraNam 1\n\n manidar uNavai manidar parikkum vazhakkam ini uNDO\nmanidar nOha manidar pArkkum vAzhkkai iniyuNDO (nalmilanda) \niniya mozhigaL  neDiya vayangaL eNNarum peru nADu\nkaniyum kizhangum dhAnyangaLum kaNakkinrit-taru nADu idu\nkaNakkinrit-taru nADu nitta nittam kanakkinrittaru nADu vAzhga\n\n\ncaraNam 2\n\n ini oru vidhi sheivOm adai enda nALum kAppOm\ntaniyoruvanukk-uNavillaiyenil jagattinai azhittiDuvOm vAzhga\n\n\ncaraNam 3\n\n ellA uyirgaLilum tAnE irukkirEn enruraittAn kaNNa perumAn\nellArum amara nilaiyeidu nan muraiyai indiyA ulagirkk-kaLikkum Am \nindiA ulagairk-kaLikkum Am Am indiA ulagirk-kaLikkum vAzhga\n\n\ncaraNam 4\n\n ellArumOr kulam ellArumOr inam ellArum indiA makkaL\nellArumOr nirai ellArumOr vilai ellArum innATTu mannar nAm\nellArum innATTu mannar Am ellArum innATTu mannar vAzhga  \n\n\n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0005.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'bhooloka kumaari',
    raga: ['amritavarshini', 'behaag', 'karnaaTaka dEvagaandhaari'],
    lyrics:
      'pallavi\n\n bhUlOka kumAri hE amrtadhAri\n\nanupallavi\n\n AlOka shrngAri amrta kalasha kusha pArE\nkAla bhaya kuTAri kAma vAri kanaka latA rUpa garva timirArE\n\ncaraNam\n\nbAlE rasajAlE bhagavati prasIta kAlE nIla ratnamaya nEtra vishAlE\nnitya yuvati pada niraja mAlE lIlA jvAlA nirmita vANi nirantarE nikhila\nlOkEshAni nirupama sundari nitya kalyANi nijam mAm kuru hE manmata rANi\n\n  \n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0006.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'chandiranoLiyil',
    raga: ['lalitaa'],
    lyrics:
      'pallavi\n\n  candiranoLiyil avaLaik-kaNDEn sharaNam enru pughundu koNDEn\nanupallavi\n\n indriyangaLai venru viTTEn enadenrAshaiyaik-konru viTTEn\n\ncaraNam 1\n\n payanillAmal uzhaikka shonnAL bhakti sheidu pizhaikka shonnAL\ntuyarillAdenai sheidu viTTAL tunbamenbadai koidu viTTAL\n   \ncaraNam 2\n\n mIngaL sheyyum oLiyai sheidAL vIshi nirkkum vaLiyai sheidAL\nvAngaLuLLa veLiya sheidAL vAzhi nenjirk-kaLiyai sheidAL   \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0007.shtml',
    tala: 'aadi',
    composer: 'Ambujam Krishna',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'aravinda padamalar',
    raga: ['kaapi'],
    lyrics:
      'pallavi\n\naravinda padamalar nOgumO (unran) aDimai enakkirangi AtkoLLa vandiDil\n\nanupallavi\n\nviraindu tiraikaDal kaDandu arakkanin Iraindu shiram koNDa rAghavanE\nunran\n\ncaraNam\n\nkuraL vaDivAi vandu IrEzhulagaLandAi caraNamadAl kanni shApamum\ntIrttAi aravak-koDiyOniDam\n\naivarukkAga shenrAi karuNAnidhiyun tirunAmam shollik-kanindu meiyurugiDa\nazhaittiDum enakkenil\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0008.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'dEhi mutham',
    raga: ['kamaas'],
    lyrics:
      'pallavi\n\n dEhi mudam dEhi shrI rAdhE rAdhE\n\ncaraNam 1\n\n rAga samudrajAmrtE rAdhE rAdhE rAjnI maNDala ratna rAdhE rAdhE\nbhOgAdi kOTi tulya rAdhE rAdhE (jaya jaya) bhUdEvi tapaha phala rAdhE rAdhE\n\n   \ncaraNam 2\n\n vEda mahA mantra rasa rAdhE rAdhE vEda vidyA vilAsini shrI rAdhE rAdhE\nAdi parA shakti rUpa rAdhE rAdhE atyadbhuta shrngAramaya rAdhE rAdhE\n\n   \ncaraNam 3\n\n kAdalenum tIvinilE rAdhE rAdhE (anru) kaNDeDutta peNmaNiyE rAdhE rAdhE\n kAdalenum shOlaiyilE rAdhE rAdhE (ninra) karpakamAm pUttaruvE rAdhE rAdhE\n mAdarashE shevap-peNNE rAdhE rAdhE vAnavargaLin inba vAzhvE rAdhE rAdhE\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0009.shtml',
    tala: 'aadi',
    composer: 'OotukkaaDu VenkaTasubbaiyar',
    language: 'Sanskrit',
    updated: '06/10/2005',
    title: 'bhajanaamrita paramaananda',
    raga: ['naaTTai'],
    lyrics:
      'pallavi\n\nbhajanAmrta paramAnanda bhAgavata santa caraNarEnum nirantaram\nvahAmyaham harinija\n\nanupallavi\n\nvraja rAjakumAra manOhara vENugAna shravaNAnanda vraja sundari\njana pada pankaja sama anukampita hrdi smara sambhava nija\n\ncaraNam 1\n\nnArAyaNa nAma rasana paramAnandayuta hrdaya jitakalmaSa nara\nsimha dayA nitimiva dharaNa sadA kanakakashipu suta Adaya\n\ncaraNam 2\n\nparahita karuNAkara varasmita mukha bhava parAbhava parama pAvanasara\nsijabhava sukumAra sanaka sanandana sanAtana nArada sukha ati\n\ncaraNam 3\n\ntAraka mantra sadApaTanam krta tarakaradala sanjIvi girim krta\ndasharatha rAjakumAra hitam krta sadA gati pavana kumArAdi hari\n\ncaraNam 4\n\ndashamukha sOdara guha shabarI sugrIvAngada sucarita mahAbhAgya\nrAmENa bahubhASita bhAvita vIkSita rakSita mitra pavitrita\n\ncaraNam 5\n\nbhAgavata gatAha paTana shravaNa sadA smaraNa bhajana guNa kIrtanaya\ntA gatita krSNa carita varNanam tathAnukUla prakaTana vitaraNa hari\n\ncaraNam 6\n\nnandIsha matanga vyAghrapAda sahasrapanA makuTa dhara tumburu\ncaNDIsha mrkaNdu suta munigaNa santa tanuja rajata shailastitha shiva\n\ncaraNam 7\n\nshivahari sharavaNabhava guha bhajana nirantara mAlAlankrta shObha\nvAgIsha shiva pAda hrdaya suta manivAcaka sundaraDiNDima kavirAja\nmadhurakavi rAja rAmAnuja kulashEkhara viSNucittapara kAla\npurandara tuLasidAsa charaNAravinda dhULi hari shiva guha\n\ncaraNam 8\n\nkrSNa gatA karNanavita japatapa stOtra ghvaNitArcana yOga\nrAsa mahOtsava vibhava bhAva paramadbhuta nartana vara nrtya catura\nagaNita rAga nava vidha tALa kramalaya gatIshvara tantrisamanvita\nAnandAtishaya sukha nimaghna ananta mahAnta caraNAravinda\n\ncaraNam 9\n\nrAma rAghava kEshava raghukula nandana maithilI ramanA\nkrSNa gOkula vaibhava nanda nandana kALIya phaNa naTanA\nsOmashEkhara sundara naTana cidambara shailajA ramNA\nbAhulEya sikhivAha dayApara pAhi itividha nAma nija hari\n\ncaraNam 10\n\nkSaNamapi hariguNa gatita mahOttama kSaNamapi shravaNa sukrta\nkaramOttama kSaNamapi darshita\nsadsangha parOttama janma janmamapi pankaja padamiha antakaraNa krta\nantaranga hari\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0010.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'dillit-thurukkar',
    raga: ['naadanaamakriya'],
    lyrics:
      'caraNam 1\n\n dillit-turukkar sheida vazhakkamaDi pengaL tiraiyiTTu mukhamalar maraittu vaittal\nvalli iDaiyinaiyum Ongi mun nirkkum inda mArbaiyu mUDuvadu sAttirak-kaNDAi\nvalli iDaiyinaiyum mArbiraNDaiyum tuNi maraittadanAl azhagu maraindadllai\nshollit-terivadillai manmatak-kalai mukha jyOti maraittumoru kAdalinguNDO\n\n\ncaraNam 2\n\n Ariyar munnerigaL mEnmaiyengirAr paNDai Ariyap-peNgaLukkut-tiraigaLuNDO\nOriru murai kaNDu pazhagiya pin verum oppukkuk-kATTuvadin-nANamennaDi\nyarinrundennai ingu taDuttiDuvAr valuvAga mukhat-titaiyai aghaTriviTTAl\nkAriyamillaiyaDi vIn pashappilE kani kaNDavan tOlurikka kAttiruppEnO \n\n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0011.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'ellai illaadadOr',
    raga: ['raagamaalika'],
    lyrics:
      'caraNam 1\n\nellai illAdadOr vAnak-kaDaliniDai veNNilAvE vizhik-kinbam aLippadOr nIvenrilaguvai veNNilAvE shollaiyum kaLLaiyum nenjaiyum shErttirungum veNNIlAvE ninran jyOti mayakkaum vaghaiyadu tAnen shol veNNilAvE\nnalla oLiyin vaghai pala kaNDilan veNNilAvE nanavai marandiDa sheivadu kaNDilan veNNIlAvE kollum amizhdai nigharttiDungL onru veNNilAvE vandu kUDi irukkudu ninnoLiyODikku veNNIlAvE\n\n\ncaraNam 2\n\n mAdar mukhattai ninakkiNai kUruvar veNNilAvE ahdu vayadirk-kavalaiyinOvirk-keDuvadu veNNilAvE kAdalorutti iLaya prAyattaL veNNilAvE andak-kAman ran villaiyiNaitta puruvattaL veNNilAvE mIdezhuman pin viLai punnakaiyinaL veNNilAvE muttam vENDimun kATTU mukhattin ezhilukku veNNilAvE shAdal azhidal ilAdu nirantaram veNNilAvE nin taN mukham tannil viLanguvadennai kol veNNIlAvE\n\ncaraNam 3\n\n ninnoLiyAghiya pArkkaDal mIdingu veNNilAvE nangu nIyum amudum ezhundiDal kaNDanan veNNilAvE mannu poruLgaL anaittilum nirppavan veNNilAvE anda mAyana pArkkaDal mIdural kaNDanan veNNilAvE tunniya nIla nirattaL parAshakti veNNilAvE ingut-tOnrum ulagavaLe enru kUruvar veNNilAvE pinniya mEgha shaDaimishai gangaiyum veNNilAvE peTpura nIyum viLangu nal kaNDana veNNilAvE\n\ncaraNam 4\n\n kAdalar nenjai veruppuvai nIyenbar veNNIlAvE ninaik-kAdal sheivAr nenjikkinnamudAguvai veNNilAvE shIta maNi neDu vAnak-kuLattiDai veNNilAvE nI dEshu mighunda ventAmarai pOnranai veNNIlAvE mOdavarum karu mEghat-tiraLinai veNNilAvE nI muttinoLit-tazhagura sheiguvai veNNilAvE tIdu purindiDa vandiDum tIyarkkum veNNilAvE nalam sheidoLi nalguvar mEl avarAm enrO veNNilAvE\n\ncaraNam 5\n\n melliya mEghat-tiraikkuL maraindiDum veNNilAvE unran mEni azhagu mighaippaDak-kANudu veNNilAvE nalliyavAr yavanattiyar mEniyai veNNilAvE mUDu naTrirai mEni nayamighak-kATTiDum veNNilAvE sholliya vArtaiyil nANuTranai pOdum veNNilAvE nin jyOti vadana muzhudu maraittanai veNNIlAvE pulliyan sheida pizhai poruttE aruL veNNilAvE iruL pOghiDa sheidu ninadezhil kATTudi veNNilAvE  \n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0012.shtml',
    tala: 'khaNDa aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'endaiyum taayum',
    raga: ['kaambhOji'],
    lyrics:
      "caraNam 1\n\nendaiyum tAyum magizhndu kulAvi irundadum innADE adan \nmundaiyar Ayiram ANDugaL vAzhndu muDindadum innADE avar\ncintaiyil Ayiram eNNam vaLarndu shirandadum innADE idai\nvandanai kUri manadil irutti en vAyura vAzhttEnO idai\n'vandE mAtaram vandE mAtaram' enru vaNangEnO\n\n\ncaraNam 2\n\n innuyir tandemai Inru vaLarndu aruL Indadum innADE engaL\nannaiyar tOnri mazhalaigal kUri arindadum innADE avar\nkanniyarAgi nilavinilADik-kaLittadum innADE tangaL\nponnuDal inbura nIr viLaiyADi il pOndadum innADE idai\n'vandE mAtaram vandE mAtaram' enru vaNangEnO\n\n\ncaraNam 3\n\n mangaiyarAi avar illaram nangu vaLarttadum innADE avar\ntanga madalaigaL Inramu-dUTTit-tazhuviyadinnADE makkaL\ntungamuyarndu vaLargenak-kOyilgaL shUzhnadaum innADE pinnar\nangavar mAya avaruDarp-pUttugaL Arndadum innADE idai\n'vandE mAtaram vandE mAtaram' enru vaNangEnO\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.",
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0013.shtml',
    tala: 'roopaka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'engaL kaNNammaa',
    raga: ['shenjuruTTi'],
    lyrics:
      'pallavi\n\n engaL kaNNammA naghai pU rOjAppU engal kaNNammA vizhi indra nilappU\nengaL kaNNammA mukham shentAmaraippU engaL kaNNammA nudal bAla sUriyan\n\ncaraNam 1\n\n engaL kaNNammA ezhil minnalai tErkkum engal kaNNammA puruvangaL madan virkkaL\ntingaLai muDiya pAmbinaip-pOla shEri shuzhal ivan nAshi eTpU\n\n   \ncaraNam 2\n\n mangaLa vAkku nityAnanda Utru madhura vAi amirtam idazh amirtam\nsangItamen kural sarasvati vINai shAya varambai catur ayirANi\n\n   \ncaraNam 3\n\n inkita nAda nilayam iru shevi shangu nigharnda khaNDam amirta sangam\nmangaLak-kaigaL mahAshakti vAsam vayirAvilai iDai amirta vIDu\n\n   \ncaraNam 4\n\n shankaranait-tAngu nandipada caturam tAmarai irutAL lakSmI pITham\npongit-tadumbi dishaiyengum pAyum buddhanbum jnAnamum meittirukkOlam\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0014.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'engaL vELvi',
    raga: ['naadanaamakriyaa'],
    lyrics:
      'caraNam 1\n\n riSigaL:  engaL vELvik-kUThamidil ErudE tI tI innEram bhangamuTrE pEigaLODap-pAyudE tI tI innEram\n\ncaraNam 2\n\n asurar:  tOzharE nammAvi vEva shUzhudE tI tI ayyO nAm vAzha vanda kADu vEva vandadE tI tI ammAvO\n\ncaraNam 3\n\n riSi:  ponnaiyottOr eNNamuTrAn pOndu viTTAnE innEram cinnamAghip-poi arakkar shindi vIzhvArE innEram \n\ncaraNam 4\n\n asurar:  indirAdi dEvar tammai Eshi vAzhttOmE ayyO nAm vendu pOgha mAniDakkOr vEdamuNDAmO\n     ammAvO\n\ncaraNam 5\n\n rISi:  vAnai nOkkik-kaigaL tUkki vaLarudE tI tI innEram jnAna mEni udaya kanni naNNi viTTALE innEram\n\ncaraNam 6\n\n asurar:  kOTi nALAi ivvanattil kUDi vAzhndOmE ayyO nAm pADi vELvi mAndar sheyyap-paNbizhaittOmE\n     ammAvO\n\ncaraNam 7\n\n riSi:  kATTil mEyum kALai pOnrAN kANuvIr tI tI innEram OTTiyOTTip-paghaiyai ellAm vATTuginrAnE\n     innEram\n\ncaraNam 8\n\n asurar:  valiyilAdAr mAndarenru magizhndu vAzhndOmE ayyO nAm kaliyai venrOr vEda uNmai kaNDu kondArE\n     ammAvO\n\ncaraNam 9\n\n riSi:  valimai maindan vELvi munnOn vAi tirandAnE innEram maliyu neyyum tEnum uNDu magizha vandAnE\n     ammAvO\n\ncaraNam 10\n\n asurar:  uyirai viTTum uNarvai viTTum Odi vandOmE ayyO nAm tuyiluDam pin mIdilum tI tOnri viTTANE\n       ammAvO\n\ncaraNam 11\n\n riSi:  amarar dUtan camara nAthan ArttezhundAnE innEram kumari maindan enadu vAzhvil kOyil koNDAnE\n       InnEram\n\ncaraNam 12\n\n asurar:  varuNan mitran arya mAnum maduvai uNbArO ayyO nAm perugu tIyin pughaiyum veppum pinni\n       maivAyO ammAvO\n\ncaraNam 13\n\n riSi:  amararellAm vandu nammun avigaL koNDArE innEram namanumillai paghaiyumillai nanmai kaNDOmE\n       innEram\n\ncaraNam 14\n\n asurar:  paghanumingE inbameidip-pADuginrAnE ayyO nAm pughaiyil vIzha indiran shIr pongal kaNDIrO\n       innEram\n\ncaraNam 15\n\n riSi:  iLaiyum vandAL kavitai vandAL iravi vandAnE innEram vinaiyum engaL tIyinAlE mEnmaiyuTrOmE\n       innEram\n\ncaraNam 16\n\n riSi:  annam uNbIr pAlu neyyum amudum uNbIrE innEram minni ninrIr dEvarengaL vELvi koLvArE innEram\n\ncaraNam 17\n\n riSi:  sOmamuNdu dEvar nalgum jyOti peTrOmE innEram tImai tIrnE vAzhiyinbam shErndu viTTOmE innEram\n\ncaraNam 18\n\n riSi:  uDaduyir mEl uNarvilum tI Ongi viTTAnE inEram kaDavuLartAm emmai vAzhttik-kai koDuttArE innEram\n\ncaraNam 19\n\n riSi:  engum vELvi amararengum yAngaNum tI tI innEram tangum inbam amara vAzhkkai shArndu ninrOmE\n       innEram\n\ncaraNam 20\n\nriSi:  vAzhga dEvar vAzhga vELvi mAndar vAzhvArE innEram vAzhga vaiyyam vAzhga vEdam vAzhga tI tI tI\n      innEram \n\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0015.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'engirunthu varuguvathO',
    raga: ['hindustaani tODi'],
    lyrics:
      'engirundu varuguvadO oli yAvar sheiguvadO aDi tOzhi\n\ncaraNam 1\n\n kunrininrum varuguvadO marak-kombininrum varuguvadO veLi\nmanrininru varuguvadO enran madi maruNDi sheigudaDi ihd-\n\n   \ncaraNam 2\n\n alai olittiDum deiva yamunai Atrininrum varuguvadO anri\n ilai olikkum pozhiviDai ninrum ezhuvadO ihdin-namudaippOl \n\n\ncaraNam 3\n\n kATTininrum varuguvadO nilAk-kATraik-koNDu taruguvadO\nnATTininrumit-tenral koNarvadO nAdamihd-Enuyirai urukkudE\n\n\ncaraNam 4\n\n paravaiyEdumonr-uLLaduvO ingan pADumO amudakkanarp-pATTu\nmaraivininrum kinnararAdiyar vADyattin ishai iduvO aDi\n\n\ncaraNam 5\n\n kaNNanUdiDum vEinkuzhal tAnaDi kAdilEyamuLLattil nanju\npaNNanrA maDi bhAvaiyar vADap-pADi eidiDum ambaDi tOzhi    \n\n\n \n\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0016.shtml',
    tala: 's',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'enru piranthavaL',
    raga: ['mOhanam'],
    lyrics:
      'pallavi\n\n enru pirandavaL enruNarAda iyalbinaLAm engaL tAi engaL tAi\nanupallavi\n\n yArum vaghuttark-kariya pirAyattaL AyinumE engaL tAi engaL tAi\n\ncaraNam\n\n nallaram nADiya mannarai vAzhtti nalam purivAL engaL tAi avar\nallavarAyin avarai vizhungi Anandak-kUttiDuvAL engaL tAi\n\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0017.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'enru thaNiyum',
    raga: ['kamaas'],
    lyrics:
      'caraNam 1\n\n enru taNiyum inda sutantira dAgham enru maDiyumengaL aDimaiyil mOham\nenremadannai kai vilangugaL pOghum enremadinnalgaL tIrndu poyyAghum\nanroru bhAratam Akka vandOnE Ariyar vAzhvinai AdarippOnE\nvenri tarum taNai ninnaruLanrO meyyaDiyOminum vADudal nanrO\n\n\ncaraNam 2\n\n pancamu nOyunin meippaDiyArkkO pArinil mEnmaigaL vErini yArkkO\ntanjam aDaindapin kai viDalAmO tAyundan kuzhandaiyait-taLLiDappOmO\nanjalenraruL sheyum kaDamaiyillAyO Ariya nIyu nin aramarandAyO\nvensheyalakkarai vITTiDuvOnE vIra shikhAmaNi AriyarkOnE  \n\n\n\n\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0018.shtml',
    tala: 'aadi',
    composer: 'OotukkaaDu VenkaTasubbaiyyar',
    language: 'Sanskrit',
    updated: '06/10/2005',
    title: 'agaNita mahimaadbhuta',
    raga: ['gowLa'],
    lyrics:
      'pallavi\n\nagaNita mahimADbhuta lIla sadA karSita rajasAdi sadhyAtmaka\nprapanca paripAla ananta paryanga shayana namO namastE\n\nanupallavi\n\nkhaga turanga karuNAlavAla madhukaiTabAdi suraripu kulakAla\n\nmadhyamakaalam\n\nkamalA mukha kamalashilImukha suragaNa sajjana natAngriyuga\n\ncaraNam\n\nnamO namastE puruSOttama namO namastE nArAyaNa puruSOttama\nnamO namastE punarapi punarapi nArAyaNA ananta lOkapatE\n\na: shrtajana kali kalmaSa hara dAnavakula bhanjana ramA ramaNa (namO)\n\nb: manasAmrga nAnAvidha mukti vidhAyaka carAcarAtmaka rUpa (namO)\n\nc: vidUra kuyOginAm pada pankaja vinuta janAvana ramita paramIsa (namO)\n\nd: dAna sau mana tapOya sAdaya tantra mantra phala dAyaka mangaLa\ngAna sampada nAradAdi munigIya mAnavara kIrti vidhAraNa (namO)\n\ne: kSIra pArAvara taranga mrdu taraLa pankajApatayE\nkSitijApatayE kSitIpadayE dinakara candra padayE padayE\nsAdhu janAmpadayE vrajapadayE tAna yOga japatapa sAdhana\nsangIta paramOda vidhAyaka padayE madhu muraharayE (namO)\n\nf: diVya mangaL vigraha shObhamAna jaladha varNa gambhIra shubAnga\ndhIra dharOnnata vilAsa bhAsura dEva dEva mahanIya uttunga\nbhava timira ghOra haramikira kOTi vijita kamaladaLa karuNA pAnga\nbhAvita vIhita nimitta sad prEma bhAgavata jana hrdayAnta ranga\n\ng: candra jaTAdhara bhagavAnnata daitya varya manu kuTumbavEna\njanakAnka dhruva mucukunda vidEha gAti raghu nAkuSa mAndAtAnu\ncandanu bali randi dEva pippilAda bhUriSENa dilIpa\nudanga dEvala sArasvata shakara parAshara vijaya vidura adUrt-\ntayAmbarIkSa vibhISaNa atishaya mahimOttama citta bhAva\nmAruta tanaya pramukhAdi bhAgavata vinuta nirantara manO ramaNa (namO)\n\nsAmOda gOpIjana brndAraka sarasAnga sundara rAdhApatE\nsarvadA bharita gOgaNa gOvardhana taraNa bhujanga shirasI naTana (agaNita)\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0019.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'innum orumurai',
    raga: ['bhooshaavaLi'],
    lyrics:
      'pallavi\n\ninnum orumurai sholvEn pEdai nenjai edarkkum ini ulaivadilE payanonrillai\nanupallavi\n\n munnar namadiccaiyinAr pirandOm illai mudal irudi iDai namadu vashattil illai\nmanamAra uNmaiyinai puraTTalAmO mahAshakti sheida nanri marakkalAmO\n\n\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0020.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'iyarkai enrunai',
    raga: ['bilahari'],
    lyrics:
      'pallavi\n\niyarkkai enrunai uraippAr shilar iNangum aim-bhUtangaL enruraippAr shilar\nanupallavi\n\n sheyarkkaiyin shakti enbAr uyirt-tIyenbAr arivenbAr IshanenbAr\n\ncaraNam\n\n viyappura tAL ninakkE ingu vELvi sheidiDum engaL Om ennum\nnayappaDum adu uNDE shiva nATTiyam kATTi aruL purivAr\n\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0021.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'jaya bhErikai',
    raga: ['shankaraabharaNam'],
    lyrics:
      'pallavi\n\njaya bhEriki koTTaDA koTTaDA jaya bhErikai koTTaDA\n\ncaraNam 1\n\n bhayamenum peitanaiyaDittOm poimaip-pAmbaip-piLanduyiraik-kuDittOm\nviyan-ulaganaittum amudena nigarum vEda vAzhvinaik-kai piDittOm\n   \ncaraNam 2\n\n iraviyin oLiyiDaik-kuLittOm oLi innamudinaik-kaNDu kaLittOm\nkaravinil vanduyirk-kulattinai azhikkum kAvalan naDunaDunga vizhittOm\n   \ncaraNam 3\n\n kAkkai kuruvi engaL jAti nIL kaDalum malaiyum engaL kUTTam\nnOkkud-dishaiyellAm nAmanri vErillai nOkka nOkkaLiyATTam\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0022.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'jeyamuNDu bhayamillai',
    raga: ['kamaas'],
    lyrics:
      'pallavi\n\njayamuNDu bhayamillai manamE inda janmattilE viDudalaiyuNDu nilaiyuNDu\nanupallavi\n\n bhayamuNDu bhaktiyinAlE nenjil padivuTra kulashakti sharaNuNDu paghaiyillai\n\ncaraNam 1\n\n bhayamuNDu kunrattaip-pOlE shakti porp-pAda munDadan mElE \nniyamamellAm shakti ninaivanrip-piridillai neriyuNDu kuriyuNDu kula shakti veriyuNDu\n   \ncaraNam 2\n\n matiyuNDu shelvangaL shErkkum deiva valiyuNDu tImaiyaip-pOkkum\nvidhiyuNDu tozhilukku viLaivuNDu kuraivillai vicanappoik-kaDaluk-kumaran kaik-kaNaiyuNDu\n   \ncaraNam 3\n\n alaipaTTa kaDalukku mElE shakti aruLenum dONiyinAlE\n tolayoTTik-karaiyuTrut-tuyaraTru viDupaTTut-tuNiyuTra kula shakti caraNattil muDidoTTu\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0023.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'kAdal kAdal kAdal',
    raga: ['shankaraabharaNam'],
    lyrics:
      'pallavi\n\nkAdal kAdal kAdal kAdal pOyirk-kAdal pOyirk-shAdal shAdal shAdal\n\ncaraNam 1\n\n aruLEyA nalvoLiyiE oLI pOmAyin oLi pOmAyin iruLE irulE iruLE\n\ncaraNam 2\n\n inbam inbam inbam inbattirk-kOr ellai kANil tunbam tunbam tunbam\n\ncaraNam 3\n\n nAdam nAdam nAdam nAdattEyOr nali uNDAyin shEdam shEdam shEdam\n\ncaraNam 4\n\n tALam tALam tALam tALattirk-kOr taDai uNDAyin kULam kULam kULam\n\ncaraNam 5\n\n paNNE paNNE paNNE paNNIrkkEyOr pazhuduNDAyin maNNE maNNE maNNE\n\ncaraNam 6\n\n pugazhE pugazhE pugazhE pugazhukkEyOr purai uNDAyin igazhE igazhE igazhE\n\ncaraNam 7\n\n urudi urudi urudi urudikkEyOr uDai uNDAyin irudi irudi irudi\n\ncaraNam 8\n\n kUDal kUDal kUDal kUDip-pinnE kumarar pOyin vADal vADal vADal\n\ncaraNam 9\n\n kuzhalE kuzhalE kuzhalE kuzhalirk-kIral kUDum kAlai vizhalE vizhalE vizhalE\n\n\n\n \n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0024.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/14/2005',
    title: 'kaiyai shakthi thanakke',
    raga: ['bhoopaaLam'],
    lyrics:
      'kaiyai shakti tanakke karuviyAkku adu sAdanaigaL vAvinaiyum kUDum kaiyai\nshakti tanakkE karuviyAkku adu shaktiyuTruk-kallainaiyunjADum   \n\nkaNNai shakti tanakkE karuviyAkku adu shakti vazhiyinai adu kANum kaNNai\nshakti tanakkE karuviyAkku adu sattyamu nallaruLum pUNum\n\nshevi shakti tanakkE karuviyAkku shiva shakti sholu mozhiyadu kETkum shevi\nshakti tanakkE karuviyAkku adu shakti tiruppADalinai vETkum\n\nvAi shakti tanakkE karuviyAkku shiva shakti pugazhinai adu muzhangum vAi\nshakti tanakkE karuviyAkku adu shakti neri yAvinaiyum vazhangum\n\nshiva shakti tanai nAshi nittamugarum adai  shakti tanakkE karuviyAkku\nshiva shakti shuvaiyinai nugharum shiva shakti tanakkE emadu nAkku\n\nmeiyyai shakti tanakkE karuviyAkku shiva shakti tarundiranadi vErum meiyyai\nshakti tanakkE karuviyAkku adu sAdalaTra vazhiyinait-tErum\n\nkhaNdam shakti tanakkE karuviyAkku adu candanamu nallamudaip-pADum khaNDam\nshakti tanakkE karuviyAkku adu shaktiyuDanenru muravADum\n\ntOL shakti tanakkE karuviyAkku adu dAraNiyumEgu vaghuttAngum tOL\nshakti tanakkE karuviyAkku adu shakti peTru mEruvenavOkkum\n\nnenjam shakti tanakkE karuviyAkku adu shaktiyura nittam virivAghum nenjam\nshakti tanakkE karuviyAkku adait-tUkka varum nAl odungip-pOghum\n\nshiva shakti tanakkE emadu vayiru adu shAmbaraiyu nalla uNavAkkum shiva\nshakti tanakkE emadu vayiru adu shakti pera uDalinai kAkkum\n\niDai shakti tanakkE karuviyAku nalla shaktiyuLLa santatigaL tOnrum iDai\nshaktitanakkE karuviyAkku ninran jAti muTru nallarattilUnrum\n\nkAl shakti tanakkE karuviyAkku adu shADiyezhu kaDalaiyum tAvum kAl\nshakti tanakkE karuviyAkku adu sancalamilAmalengum Ongum\n\nmanam shakti tanakkE karuviyAkku adu sancalangaL tIrttorumai kUDum manam\nshakti tanakkE karuviyAkku adu sAttuvIkat-tanmaiyinai shUDum\n\nmanam shakti tanakkE karuviyAkku adu shaktiyaTra cintanaigaL tIrum manam \nshakti tanakkE karuviyAkku adil cArunalla urudiyum shIrum\n\nmanam shakti tanakkE karuviyAkku adu shakti nuTpam yAvinaiyu nADum manam\nshakti tanakkE karuviyAkku adu shakti shaktiyenru kudittADum\n\nmanam shakti tanakkE karuviyAkku adu shaktiyinai eddishaiyum shErkkum manam\nshakti tanakkE karuviyAkku adu tAn virumbil mAmalaiyaip-pErkkum\n\nmanam shakti tanakkE karuviyAkku adu santatamum shaktigaLai shUzhum manam\nshakti tanakkE karuviyAkku adil shAvu perum tIvinaiyum Uzhum\n\nmanam shakti tanakkEyurimaiyAkku edait-tAn virumbinAlum vandu shErum manam\nshakti tanakkE yurimaiyAkku uDal tanniluyar shakti vandu nErum\n\nmanam shakti tanakkE karuviyAkku indad-dAraNiyil nUru vayadAgum manam\nshakti tanakkE karuviyAkku unnai shAravanda nOi izhandu pOghum\n\nmanam shakti tanakkE karuviyAkku tOL shakti peTRu nalla tozhil sheyyum manam\nshakti tanakkE karuviyAkku engum shakti aruL mAri vandu peyyum\n\nmanam shakti tanakkE karuviyAkku shiva shakti naDai yAvu nangu pazhagum manam\nshakti tanakkE karuviyAkku mukham shArndirukku nalruLu mazhagum\n\nmanam shakti tanakkE karuviyAkku uyar shAstirangaL yAvu nangu teriyum manam\nshakti tanakkE karuviyAkku nalla sattiya viLakku nittameriyum\n\ncittam shakti tanakkEyurimaiyAkku nalla tALa vaghai shantavaghai kATTum cittam\nshakti tanakkEyurimaiyAkku adil shArunalla vArttaigaLum pATTum\n\ncittam shakti tanakkEyurimaiyAkku adu shaktiyai elllOrkkum uNarvuttum adu\nshakti tanakkEyurimaiyAkku adu shakti pugazh dikkanaittu niruttum\n\ncittam shakti tanakkEyurimaiyAkku adu shakti shaktiyenru kuzhalUdum cittam\nshakti tanakkEyurimaiyAkku adil shArvadillai accamuDan shUdum\n\ncittam shakti tanakkEyurimaiyAkku adu shaktiyenru vINaitanil pEshum cittam\nshakti tanakkEyurimaiyAkku adu shakti parimaLamingu vIshum\n\ncittam shaktitanakkEyurimaiyAkku adu shaktiyenru tALamiTTu muzhakkum cittam\nshaktitanakkEyurimaiyAkku adu sancalangaL  yAvinaiyum azhikkum\n\ncittam shakti tanakkEyurimaiyAkku adu shakti vandu kOTTai kaTTi vAzhum cittam\nshakti tanakkEyurimaiyAkku adu shakti aruT cittirattil Azhum\n\nmati shakti tanakkEyuDaimaiyAkku adu sankaTangaL yAvinaiyumuDaikkum mati\nshakti tanakkEyuDaimaiyAkku  angu sattiyamu nallamuram kiDaikkum\n\nmati shakti tanakkEyuDaimaivAkku adu shAra varum tImaigaLai vilakkum mati\nshaktitanakkEyuDaimiyAkku adu sancalap-pishAshugaLai k-kalakkum\n\nmati shaktitanakkEyuDaimaiyAkku adu shakti sheyyum vindaigaLait-tEDum mati\nshaktitannakEyuDaimaiyakku adu shaktiyuraiviDaigaLai nADum\n\nmati shaktitanakkEyuDaimaiyAkku adu tarkkamenum kATTilaccu nIngum mati\nshaktitanakkEyudaimaiyAkku adil taLLI viDum poindEriyum tIngum\n\nmati shaktitanakkEyuDaimiyAkku adil sancalattin tIyaviruL vilagum mati\nshaktitanakkEyuDaimaiyAkku adil shaktiyoLi nittamu ninrilagum\n\nmati shaktitanakkEyuDaimayAkku adil shArvadillai aiyamenum pAmbu mati\nshaktitanakkEyuDaimiyakku angu tAnmunaikku mukti vidaik-kAmbu\n\nmati shaktitanakkEyaDaimiaiyAkku adu dAraNiyil anbunilai nATTum mati\nshaktitanakkEyaDaimaiyAkku adu sarva shiva shaktiyinaik-kATTum\n\nmati shaktitanakkEyaDaimaiyAkku adu shaktiruvaruLinai shErkkum mati\nshaktitanakkEyuDaimiyAkku adu tAmadap-poit-tImaigaLaip-pErkkum\n\nmati shaktitanakkEyaDaimiyAkku adu sattiyattin velkoDiyai nATTum mati\nshaktitanakkEyuDaimaiyAkku adu tAkka varum poip-puliyaiyOTTum\n\nmati shaktitanakkEyaDaimiyAkku adu sattiya nal viraviyaik-kATTum amti\nshaktitanakkEyaDaimaiyAkku adil shAravarum puyalgaLai vATTum\n\nmati shaktitanakkEyaDimaiyAkku adu shakti vira tattaiyenrum pUNum mati\nshakti vira tattaiyenrum kAttAl shiva shaktitaruminbamu nalnUNum\n\nmati shakatitanakkEyaDimaiyAkku teLi tandamudap=poigaiyena-voLirum mati\nshaktitanakkEyaDimaiyAkku santatamum inbamuramiLirum \n\nagham shaktianakkEyuDaimiyAkku adu tannaiyoru shaktiyenru tErum\nagham shaktitanakkEyuDaimaiyAkku adu tAmadamum Anavamum tIrum\n\nagham shaktitanakkEyuDaimaiyAkku adai tannaiyavaL kOyilenru kANum agham\nshaktitanakkEyuDaimaiyAkku adu tannaiyeNNit-tunbamura nANum\n\nagham shaktitanakkEyuDaimaiyAkku adu shaktiyenum kaDalilOr tivalai agham\nshaktitanakkEyuDaimaiyAkku shiva shaktiyuNDu namakkillai kavalai\n\nagham shakttanakkEyuDaimaiyAkku adil shivan Adaritta molikkum agham\nshaktitanakkEyuDaimaiyAkku adu shakti tirumEniyoLi jvalikkum\n\nshiva shaktiyenrum vAzhiyenru pADu shiva shakti shaktiyenru kudittADu shiva\nshaktiyenrum vAzhiyenrum pADu shiva shakti shaktiyenru viLaiyADu  \n\n\n\n\n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0025.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'kaakkai shiraginilE',
    raga: ['yadukulakaambhOji'],
    lyrics:
      'caraNam 1\n\n kAkkai shiraginilE nandalAlA ninran kariya niram tOnrudaiyE nandalAlA\n\ncaraNam 2\n\n pArkku marangaLellAm nandalAlA ninran paccai niram tOnrudaiyE nandalAlA\n\ncaraNam 3\n\n kEtkum oli  ellAm nandalAlA ninran gItam ishaikkudaDA nandalAlA\n\ncaraNam 4\n\n tIkkuL viralai vaittAl nandalAlA ninnait-tINDum inbam tOnrudaDA nandalAlA\n\n\n\n\n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0026.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '06/10/2005',
    title: 'kaalaa unai naan',
    raga: ['cakravaakam'],
    lyrics:
      'pallavi\n\n kAlA unai nAn shiru pullena madikkirEn enran kAlarugE vADA shaTrE unai midikkirEn aDA\n\ncaraNam 1\n\n vElAyuda virudinai manadirp-padikkirEn nalla vEdAntam uraitta jnAniyar tammai  eNNi tudikkirEn Adi \nmUlAvenru kadariya yAnaiyaik-kAkkavE ninran mudalaikku nErndadai marandAyO keTTa mUDhanE aDa\n   \ncaraNam 2\n\n ALAlam uNDavanaDI sharaNenra mArkhaNDan tan tAvikka varap-pOi nI paTTa pATTinai ariguvEn ingu\nnAlAyiram kAdam viTTaghal unai vidikkirEn hari mArAyaNanAga nin munnE udikkirEn aDa\n\n\n\n\n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0027.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/10/2005',
    title: 'kaalamaam vanattil',
    raga: ['aanandabhairavi'],
    lyrics:
      'caraNam 1\n\n kAlamAm anDak-kOla mAmarattin mIdu kALi shaktiyenra peyar koNDu rIn-\nkaramiTTulavuvumoru vaNDu tazhal kAlum vizhi nIlavanna mUla attu vAkkaLenum\nkAlgaLAruDaiya-denaikkaNDu marai kANu munivOr uraittAr paNDu\nmElumAghik-kIzhumAgi vEruLa dishaiyumAghi viNNU maNNUmAna shakti veLLam inda\nvindaiyellAm-Angadushei  kaLLam pazha vEdamA adanmunuLLa nAdamAi viLamguminda\nvIra shakti veLLam vizhum paLLam AghavENDu nittam enran Ezhai ullam\n\n\ncaraNam 2\n\n anbu vaDivAghi nirppaL tunbelAmavaL izhaippaL Akka nIkkam yAvumavan sheigai idai\nArnd-uNarndavargaLuk-kuNDuygai avaL Anandat-tin ellAiyaTra poigai\nInbavaDivAghi nirppaL tunbelAm izhaippaL ihdelAmavan puriyumAyai avaL\nEdumaTra meipporuLin shAyai enil eNNiyEnum shaktiyEnum puNNiya munivar nitta\nmeiduvAr mei jnAnamenum tIyai eritteTruvArin-nAnenum poip-pEyai \n\n\ncaraNam 3\n\n AdiyAmshivanum avan jyOtiyAna shaktiyum tAn angum ingum uLavAgum onrE-\nyAinAlulaganaittum shAgum avaienriyOr poruLumillai anriyonrumillai idai\naindiDil tuyaramellAm pOghum inda arivu nAn parama jnAnamAgum\nnItiyAm arashu sheivAr nItigaL pala koDiduppar nINDakAlam vAzhvar taraimIdu enda\nneriyum eiduvar ninaittapOdu anda nittamutta shuddha buddha satta perum kALIpada\nnizhal aDaindArkillaiyOr tIdu enru nErmai vEdam shollum vazhividu\n\n\n\n\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0028.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/10/2005',
    title: 'kanavenna kanave',
    raga: ['shree'],
    lyrics:
      'pallavi\n\n kanavenna kanavE enran paN tuyilAdu nanavinilEyuTra\n\ncaraNam 1\n\n kAnakam kaNDEnaDA kAnakam kaNDEn ucci vAnaghattE vaTTa maTiyoLi kaNDEn\n   \ncaraNam 2\n\n poTrirukkunram angOr poTrirukkunram adai shuTriyirukkum kanaigaLum poigaiyum\n   \ncaraNam 3\n\n kunrattin mIdE andak-kunrattin mIdE tani ninradoru Ala neDumaram kaNDEn\n   \ncaraNam 4\n\n pon marattin kIzh andap-pon marattin kIzh verum cinmayamAnadO dEvanirundAn\n   \ncaraNam 5\n\n buddha bhagavan engaL buddha bhagavan avan shuddha mei jnAna shuDar mukham kaNDEn\n   \ncaraNam 6\n\n gAndhiyaip-pArttEn avan gAndhiyaip-pArttEn upa shAntiyil mUzhgit-tadumbik-kuLittavan\n   \ncaraNam 7\n\n Idu nal vindai ennai Idu nal vindai buddhan jyOti maraindiruL tunniDak-kaNDanan\n   \ncaraNam 8\n\n pAinda tangoLiyE pinnum pAinda tangoLiyE aruL tEinda ten mEni shilirttiDak-kaNDEn\n   \ncaraNam 9\n\n kunrattin mIdE andak-kunrattin mIdE tani ninra poTrErum parigaLum kaNDEn\n \ncaraNam 10\n\n tErin mun pAghan maNit-tErin mun pAghan avan shIrinaik-kaNDu tighaittu ninrEnindak-\n \ncaraNam 11\n\n Om enra mozhiyum avan Om enra mozhiyum nilak-kAmanranuruvumav-vImanran tiralum \n \ncaraNam 12\n\n aruL pongum vizhiyum deiva aruL pongum vizhiyum kANil iruL pongu nenjinar veruL pongumdigiriyum\n \ncaraNam 13\n\n kaNNanaik-kaNDEn engaL kaNNanaik-kaNDEn maNI vaNNanai jnAnamalaiyinaik-kaNDEn\n \ncaraNam 14\n\n shEnaigaL tOnrum veLLa sEnaigaL tOnrum pariyAnaiyum tErum anavil tOnrum\n \ncaraNam 15\n\n  kaNNanatrEril nilak-kaNNanaTrEril migha eNNayarndAnO-rilLainjnaik-kaNDEn\n \ncaraNam 16\n\n vishaiyang-olivanE vizhal vishayang-oliivanE tani ishaiyuraikishaiyumin-givanukkin-nAmam\n \ncaraNam 17\n\n vIriya vaDivam enna vIriya vaDivam inda Ariya nenjam ayarndadEn vindai\n \ncaraNam 18\n\n peTraden pErE shevi peTraden pErE andak-koTravan shorkkaL sheviyurak-koNDEn\n \ncaraNam 19\n\n veTraiyaik-koNDEn jaya veTriyaik-koNDEn uyir aTriDumEnu malartamait-tINDEn\n \ncaraNam 20\n\n kaTral kolvEnO enran kaTral kolvEnO kiLai aTrapin sheyyum-arashumo-rarasO\n \ncaraNam 21\n\n minjiya aruLAl mida minjiya aruLAl anda konjilai vIran pala shol viriyyAn\n \ncaraNam 22\n\n immozhi kETTAn kaNNan immozhi kETTAn ayyan shemmavar vadanattil shiru naghai pUTTAn\n \ncaraNam 23\n\n villinai eDaDA kaiyil villinai eDaDA andap-pulliyar kUTTattaip-pUzhdi sheidiDaDA\n \ncaraNam 24\n\n vADi nillADE manam vADi nillADE verum bEDiyar jnAnap-piTral shillAdE\n \ncaraNam 25\n\n onruLaduNmai enrum onruLaduNmai adaik-konri DoNAdu kuraittaloNNAdu\n \ncaraNam 26\n\n tunbamumillai koDut-tunbamumillai adil inbamumillai pirap-pirappillai\n \ncaraNam 27\n\n paDaigaLum tINDA adaip-paDaigaLum tINDA anal kaDavum-oNNAda punal nanaiyAdu\n \ncaraNam 28\n\n sheidalun kaDanE aram sheidalun kaDanE adil eidurum vinaivini veNNam vaikkAdE \n\n\n\n\n\n \n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0029.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/11/2005',
    title: 'kaaNi nilam vENDum',
    raga: ['bindumaalini', 'hamsadwani', 'kOshalam'],
    lyrics:
      'caraNam 1  bindumaalini\n\n\n kANi nilam vENDum parAshakti kANi nilam vENDum angu\ntUNil azhagiyadAi nan mADangaL tuyya nirattinadAi andak-\nkANI nilattiDaiyE Or mALigai kaTTit-tara vENDum angu\nkONi  aruginile tennai maram kITrum iLanIrum\n\ncaraNam 2  hamsadwani\n\n pattup-panniraNDu tennai maram pakkattilE vENum nalla\nmuttu shuDar pOlE nilAvoLi munbu vara vENum angu\nkattum kuyilOshai shaTrE vandu kAdirp-paDa vENum enran\ncittam magizhndiDavE nanrAyiLam tenral vara vENum\n\ncaraNam 3  kOshalam\n\n paTTu kalandiDavE angEyoru pattinip-peN vEnum engaL\nkUTTuk-kaLiyinilE kavitaigaL koNDu tara vENum andak-\nkATTu veLiyinilE ammA ninran kAvalura vENum enran\npATTU tirandAlE ivvaiyattaippAlittiDa vENum \n  \n\n\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0030.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/12/2005',
    title: 'kanigaL koNDu tarum',
    raga: ['varaaLi'],
    lyrics:
      'caraNam 1\n\n kanigaL koNDu tarum kaNNan karkkaNDu pOl inidAi panI shei candanamum pinnum palvaghai yattargaLum\nkuniyum vANmukhattAn kaNNan kulavi neTriyilE iniya poTTiDavE vaNNam iyanra javvAdum\n\n\ncaraNam 2\n\n koNDai muDippadarkkE maNan kUDudayilangaLum vaNDu vizhiyunikkE kaNNan maiyum koNDutarum\ntaNDaip-padangaLukkE shemmai shArttu shem panju tarum peNDir tamakkellAm kaNNan pEsharum deivamaDi\n\n\ncaraNam 3\n\n kumkumam koNDu varaum kaNNan kuzhaittu mArbezhuda shangaiyilAda paNam tandE nazhuvi maiyal sheyyum\nbhangam-onrillAmal mukham pArttirundArp-pOrum mangaLam AghumaDi pinnOr varuttamillaiyaDi \n\n  \n\n\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0031.shtml',
    tala: 'roopakam',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/12/2005',
    title: 'kannan mana nilaiyai',
    raga: 'raagamaalika',
    lyrics:
      'caraNam 1\n\nkaNNan mana nilaiyai tangamE tangam (aDi tangamE tangam) vENDuvara vENumaDi tangamE tangam\neNNam uraittuviDil tangamE tangam pinnar Edenilum sheivamaDi tangamE tangam\n\n\ncaraNam 2\n\n kannikaiyAi irundu tangamE tangam nAngaL kAlam kazhippamaDi tangamE tangam\nanniya mannar makkaL bhUmilyil uNDAm ennum adanaiyum sholliviTTi tangamE tangam\n\n\ncaraNam 3\n\n shonna mozhi tavaru mannavanukkE engum tOzhamaiyillaiaDi tangamE tangam\nenna pizhaigal ingu kaNDikkinrAn avai yAvum teLiyu perak-kETTu vittI\n\n\ncaraNam 4\n\nmaiyal koDuttuviTTut-tangamE tangam talai maraindu tiribavarkku mAmanu muNDO\npoyyai uruvamenak-koNDAvanenrE kizhap-ponniyurattaduNDu tangamE tangam\n\n\ncaraNam 5\n\n aTram karaiyadanil munna morunAL enai azhaittut-taniyiDattil pEshiyadellAm\ntUTri nagar murashu shATruvanenrE sholli varuvaiyaDi tangamE tangam\n\n\ncaraNam 6\n\n shOra-mizhaittiDaiyar peNgaLUDanE avan shUzccit-tiramai pala kATTuvadellAm\nvIra marakkulattu mAdariDattE vENDiyadillaiyenru shollivittI\n\n\ncaraNam 7\n\n peNNenru bhUmitanil pirandu viTTAl mighap-pizhai irukkudaDi tangamE tangam\npaNNonru vEinkuzhalil Udi vandiTTAn adaip-paTri marakkudillai panjaiyuLLamE\n\n\ncaraNam 8\n\n nEra muzhugilumap-pAvi tannaiyE uLLam ninaittu marugudaDi tangamE tangam\ntIra oru shol inru kETTu vandiTTAl pinbu deivamirukkudaDi tangamE tangam\n\n \n\n\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0032.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/12/2005',
    title: 'kannan thiruvadi',
    raga: ['aarabi'],
    lyrics:
      'pallavi\n\n kaNNan tiruvaDi eNNuga maname tiNNam azhiyA vaNNam tarumE\nanupallavi\n\n tarumE nidhiyum perumai pugazhum karu mAmEnip-perumAn ingE\n\ncaraNam\n\n nalamE nADIr pulavIr pADIr nila mAmaghaLin talaivan pugazhE\npugazh vIr kaNNan taghai shEramarar tOghaiyOD-asurappaghai tIrppavanE\n\n\n \n\n\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0033.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/12/2005',
    title: 'karuthiyin kaN',
    raga: ['bhoopaaLam'],
    lyrics:
      'caraNam 1\n\n karudiyin kaN munivarum pinnE tUmozhip-pulavOr palar tAmum\nperidu ninran perumai enrEttum peTri kaNDunai vAzhttiDa vandEn\nparitiyE poruL yAvirkku mudalE bhAnuvE ponshei pEroLit-tiraLE\nkarudi ninnai vaNangiDa vandEn kadirkoL vANmukham kATTudi shaTrE\n\n\ncaraNam 2\n\n vEdam pADiya jyOtiyaik-kaNDu vELvip-pADalgaL pADudark-kuTrEn\nnAda vARk-kaDalin oliyODu naTramizh shol ishaiyaiyum shErppEn\nkAdamAyiramOr kaNattuLLE kaDugiyODum kadirinam pADi \nAdavA ninai vAzhttiDa vandEn aNikoL vANmukham kATTudi shaTrE\n\n\n\n\n \n\n\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0034.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/13/2005',
    title: 'karumbu tOttathile',
    raga: ['saindhavi'],
    lyrics:
      'pallavi\n\n karumbu tOTTattilE A karumbu tOTTattilE\n\ncaraNam 1\n\n karumbu tOTTattilE avar kAlgaLum kaigaLum shOrndu vizhumpaDi\nvarunduginranarE hindu mAdar tan nenju kodittuk-kodittup-pOi\nshurunguginranarE avar tunbattai nIkka vazhiyillaiyO oru\nmarundidarkkillaiyO shekku mADugaL pOluzhaittEnguginrAr andak-\n\n   \ncaraNam 2\n\n peNNenru sholliDilO oru pEyum irangumenbAr deivamE nina-\ndeNNam irangAdO anda Ezhalgal angu shoriyum kaNNIr verum\nmaNNil kalandiDumO terkku mA-kaDalukku naDunnilE angOr\nkaNNaTra tIvinilE tanik-kATTinil peNGaL puzhunguginrAr andak-\n\n   \ncaraNam 3\n\n nATTai ninaippArO enda nAninip-pOi adai kANbadenrEyannai\nvITTai ninaippArO avar vimmi vimmi vimmi vimmi azhum kural\nkETTiruppAi kATrE tunbak-kENiyilE engaL peNgaL azhuda shol\nmITTumuraiyAyO avar vimmi azhuvum tiram keTTup-pOyinar\n\n   \ncaraNam 4\n\n nenjam kumurugirAr karppu nIngiDar sheyyum koDumaiyilE andap-\npanjai maghaLirellAm tunbappaTTu maDinu maDindu maDindoru\n tanjamumillAdE avar shAgum vazhakkattai inda kaNattinil\nminja viDalAmO hE vIra karALi cAmuNDi kALi\n\n\n\n\n\n \n\n\n\n\n  \n\n \n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.',
    meaning: '',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0035.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '07/16/2007',
    title: 'maalaippozhudil oru mEdaimishaiyE',
    raga: ['naadanaamakriyaa'],
    lyrics:
      '1\n\nmAlaippozhudil oru mEDaimishaiyE vAnaiyum kaDalaiyum nOkkiyirundEn\nmUlak-kaDalinai avvAnavaLaiyam muttamiTTE tazhuvi mughizttal kaNDEn\nnIla nerukkiDaiyil nenju shelutti nEram kazhivadilu ninaippinriyE\nshAlap-pala pala narp-paghark-kanavil tannai marandalaiyat-tannilirundEn\n\n2  Angap-pozhudinilen pinpurattilE Alvanda ninrenadu kaN maraikkavE\npAnginirk-kai iraNDu tINDi arindEn paTTuDai vIshu kamazh tannilarindEn\nOngi varumuvaghaiyUTrilarindEn oTTum iraNDuLattil taTTilarindEn\nvAngi viDaDi kaiyaiyEDi kaNNammA mAnam evariDattil enru mozhindEn\n\n3  shiritta oliyilavaL kai vilakkiyE tirumittazhuvi enna shEdi shol enrEn\nneritta tiraik-kaDalil enna kaNDiTTAi nIla vishumbiniDai enna kaNDiTTAi\ntiritta nuraiyiniDai enna kaNDiTTAi cinnak-kumizhigaLil enna kaNDiTTAi\npirittup-pirittu nidam mEgham aLandE peTra nalangaL enna pEshudi enrAL \n\n4  neritta tirai kaDal nin mukham kaNDEn nIla vishumbiniDai nin mukham kaNDEn\ntiritta nurayiniDai nin mukham kaNDEn cinnak-kumizhigaLIl nin mukham kaNDEn\npirittu pirittu nida mEghamaLandE peTradun mukhamanrip-piridonrillai\nshiritta oliyinil un kai vilakkiyE tirumit-tazhuvi adil nin mukham kaNDEn',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 07/16/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0036.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '07/16/2007',
    title: 'malarin mevu',
    raga: ['naaTTai'],
    lyrics:
      '1 malarin mEvu tiruvE unmEl mayyal pongi ninrEn nilavu sheyyu mukham kANBAr ninaivazhikkum vizhiyum\nkhalakhalenra mozhiyum deivak-kaidulangu naghaiyum ilagu shelva vaDivum kaNDun inbam vENDuginrEn\n\n2  kamalamEvum tiruvE ninmEl kAdalAgi ninrEn kumari ninnai ingE peTrOr kOTi inbamuTrAR\namarar pOla vAzhvEn enmEl anbu koLvaiyAyin idaya verppin mOda ninmEl ishaigaL pADi vAzhvEn\n\n3  vANi tannai enrum ninadu varishai pADa vaippEn nANiyEghalAmO ennai nangarindilAyO\npENi vayamellAm nanmai peruga vaikkumvratam pUNU maindarellAm kaNNan porigaLAvaranrO\n\n4  ponnu nanmaNiyum shuDar shgei pUNgaLendi vandAi minnu ninran vaDivirp-paNigaL mEvi nirkkum azhagai\nennuraippanEDi iruvE ennuyirkkoramudae ninnai marbu sherat-tazhuvi tigharilAdu vAzhvEn\n\n5  cellameTTumeidi niiAr-shemmaiyEri vAzhvEn illai enra koDumai ulagil illaiyAga vaippEn\nmullai pOnra muruval kATTi mOhavAdai nIkki ellaiyaTra shuvaiyE enai nI enrum vAzhavaippAi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 07/16/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0037.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '07/19/2007',
    title: 'Manamenum peNNE',
    raga: ['jayantasEna'],
    lyrics:
      'pallavi  manamenum peNNE vAzhi nI kELAionraiyE paTri UshalADuvAi\nanupallavi  aDuttadai nOkki aDuttaDut-tulAvuvAi nanraiyE koL enil shErndu kai nazhuvuvAi\ncaraNam  viTTu viDenradai viDAdu pOi vizhuvAi toTTadai mInamILavum toDuvAi\npudiyadu kANIr pulanazhindiDuvOm pudiyadu virumbuvAi pudiyadai anjuvAi',
    meaning:
      "Addresing the mind personified as a young maiden, the poet says: O blessed mind, \nlisten! You latch on to one thing, and sway in its grip; anticipating the next thing, you move\nfrom one to the next and again, the next thing; when asked to focus on the good, you manage to \ngive one the slip; when told to 'leave it alone!', you hang on to it with firmer grip; you keep\nreverting to the same old thoughts; Let us lose ourselves in the new; you want the new, but are\nat the same time, are fearful of it!\n\n\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde. Meaning contributed by Suhasini Jayakumar.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 07/19/2007",
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde. Meaning contributed by Suhasini Jayakumar.',
  },
  {
    id: 'c0038.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '07/19/2007',
    title: 'mannum imaya malay',
    raga: ['bhUpALam'],
    lyrics:
      '1 mannum imaya malai engaL malaiyE mAnilamIdadu pOrpiridillaiyE\ninnoru nIr gangai yArengaL yArE ingitan mANbirk-kedirEdu vErE\n\n2  pannarum upaniDa nUlengaL nUlE pArmishaiyEdoru nUl idu pOlE\nponnoLir bhArata nADengaL nAdEpOTRuvam ihdai emakkillai IDE\n\n 3  mArata vIrar mavinda nannADu mAmunivOr palar vAzhnda ponnADu\nnArada gAna nalam tigazh nADu nallana yAvaiyum nADuru nADu\n\n4  pUraNa jnAnam polinda nannADu buddha pirAn aruL pongiya nADu\nbhArata nAdu pazham peru nAdE pADuvam ihdai emakkilai IDE\n\n5  innal vanduTriDum bOdhatark-kanjOm EzhaiyarAgi ini maNNil tunjOm\ntannalam pENi izhidozhil purivOm tAi tirunADenil inik-kaiyai viriyOm\n\n6  kannalumtEnum kaniyum inbAlum kadaliyum shendelum nalgum ekkAlum\nunnata Ariya nADEngaL nAdE Oduvam ihdE emakkillai IDE',
    meaning:
      "The great Himalayan peak is ours; is there another equal to it?\nThe waters of the Ganges are like none other;what can compare with these?\n\nThe ancient Upanishads are our texts; where in the world can you see their equal?\nThe golden bright Bharat is our land; let us celebrate it, this unique land of ours.\n\nThis country that's seen great warriors and sages,\nHome of wonderful music and all that is beautiful,\n\nThe land of the birth of ancient wisdom and the grace of Lord Buddha,\nThis Bharat of antiquity has no equal; let's sing its praises.\n\nWe won't fear tribulation; we will not give up and live in poverty\nWe will honor any work that advances our lot, we won't go a-begging, in this land of ours.\n\nThis is a land of milk and honey, where there's always plenty\nLet us remember and repeat this, of this great land of ours.\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde. Meaning contributed by Suhasini Jayakumar.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 07/19/2007",
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde. Meaning contributed by Suhasini Jayakumar.',
  },
  {
    id: 'c0039.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '07/19/2007',
    title: 'mannar kulathiniDai',
    raga: ['nAdanAmakriyA'],
    lyrics:
      '1 mannar kulattiniDaip-pirandavaLai ivan maruva tigazhndadenru nANamuTradO\ncinnam shiruk-kuzhandai enra karuttO ingu sheyyat-taghAda sheigai sheidavaruNDO\nvanna mukhat-tiraiyaik-kaLaindiDEn ninran madam kaNDu tughilinai  validurindEn\nenna karuttilaDi kaN pudaikkirAi enak-keNNap-paDuvadillaiyEDi kaNNammA\n\n2  kanni vayadilunaik-kaNDadillaiyO kannanganri shivaikka muttamiTTadillaiyO\nanniyamAga nammuL eNNuvadillai iraNDAviyum onrAgumenak-koNDadillaiyO\npannip-palavuraigaL sholluvadennE tughil parittavan kai parikka bhayam koLvanO\nennaip-puramenavum karuduvadO kaNgaL iraNDinil onrai onru kaNDu veLgumO\n\n3  nAttinirp-peNgaLukku nAyakar shollum shuvai nainda pazham kadaigaL nanuraippadO\npAttum shrutiyumonru kalandiDungAl tammuT-panni upacaraNai pEshuvaduNDO\nnIttum kadirgaLODu nilavu vandE viNNai ninru pUgazhndu viTTup-pin maruvumO\nmUTTum viraginaiya jyOtikavvungAl avai munn-upacAra vaghai mozhindiDumO\n\n4  shAttirakkArariDam kETTu vandiTTEn avar shAttiram sholliyadai ninakkuraippEn\nnETru munnALil vanda uravanraDI migha neDum paNDaik-kAlamudal nErndu vandadAm\npOTrumi rAmanena munbudittanai angu pon mithilaikkAran bhU-maDandai tAn\nUtramu dennavoru vEinkizhal koNDOn kaNNan uruva ninakkamaiyap-pArthan angutAn\n\n5   munnai mighap-pazhamai hiraNiyanAm endai mUrkham tavrkka vanda narasinga nI\npinnaiyor buddhanena tAn vaLarndiTTEn oLip-peNmai yashOdarai enrunnai eidinEn\nshonnavar shAttirattil migha vallar kAN avar shollirp-pazhudirukkak-kAraNamillai\ninnum kaDaishIvarai oTTirukkumAm adil Edukku nANamuTru kaN pudaippadE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 07/19/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0040.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'murugaa murugaa',
    raga: ['nATTai kurinji'],
    lyrics:
      'pallavi  murugA murugA murugA\ncaraNam 1 varuvAi mayil mIDinilE vaDivEluDanE varuvAi taruvAi\n nalamundAgavum  pugazhum tavamum tiramum dhanamum ghanamum\n\ncaraNam 2  aDiyAr palaringuLarE avarai viDuvittaruvAi\nmuDiyA maraiyin muDivE asurar muDivE karudum vaDivElavanE\n\ncaraNam 3  karudip-poruLE varuga tuNivE kanalE varuga\nkarudik-karudik-kavalaippaDuvAr kavalaik-kaDalaik-kaDiyum vaDivEl\n\ncaraNam 4  amarAvati vAzhvuravE aruLvAi sharaNam sharaNam\nkumarA piNi yAvaiyumE shidarak-kumurum shuDar vElavanE sharaNam\n\ncaraNam 5  arivAghiya kOyililE aruLAghiya tAi maDimEl\npori vEluDanE vaLarvAi aDiyAr pudu vAzhvuravE bhuvi mIdaruLvAi\n\ncaraNam 6  guruvE paraman maghanE guhaiyil vaLarum kanalE\ntaruvAi tozhilum payanum amarar samarAdiyanE sharaNam sharaNam',
    meaning:
      'O lord Muruga, let me see you seated on your peacock, with your spear,\nplease grant us all glory, peace and prosperity \n\nMany a devotee of yours is here, please liberate us\nYou, an end to the endless, as to the demons \n\nYou, the basis of thought, the fire and courage, please show yourself to me\nYou who destroys the basis of all worry, let me see you, O Lord! \n\nGrant me the life immortal, I bow to you\nYou shatter all our  troubles, I surrender to you, our Light\n\nIn the temple of wisdom, on the lap of mother Grace,\nMay you appear with your spear, to give new life to your devotees, on earth\n\nO teacher! the son of Lord Siva,the flame in the cave\nGrant us toil and its fruits, O immortal Lord, I surrender to you\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde. Meaning contributed by Suhasini Jayakumar.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde. Meaning contributed by Suhasini Jayakumar.',
  },
  {
    id: 'c0041.shtml',
    tala: 'roopakam',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '07/26/2007',
    title: 'naam enna sheivom',
    raga: ['punnAgavarALi'],
    lyrics:
      "pallavi  nAm enna sheivOm tuNaivarE inda bhUmiyilillAda pudumaiyaik-kaNDOm\ncaraNam 1 tighainoruvanAlE ippaDiyAccu shemmaiyum tImaiyum illAmalE pOccu\npala dishaiyum duSTar kUTTangaLAccu paiyalgaL nenjil bhayamenbadE pOccu\n\n   caraNam 2  dEshattil eNNaTra pErgaLum keTTAr sheyyum tozhil murai yAvaiyum viTTAr\npEshuvOr vArttai tAtA sholliviTTAr pin vara variyAmal sutantiram toTTAr\n\n   caraNam 3  paTTam peTrOrkku madippenbadum illai paradEshap-pEccil mayangubavarillai\nshaTTam marandOrkkup-pUjai kuraivillai sarkAriDam sholli pArttum payanillai\n\n   caraNam 4  shImait-tuNiyenrAl uLLam kodikkirAr shIrillaiyenrAlO eTTi midikkirAr\ntAmettaiyO 'vandE' enru tudikkirAr taramaTra vArtaigaL pEshik-kudikkirAr",
    meaning:
      "What shall we do now, O friend, when we see things never seen before, on earth? \n\nThere is chaos in the land; there is no recognition of good nor evil; there are gangs of thugs\nin all directions, and these lads have no fear in their hearts. \n\nCountless people listened, in this land; they quit their many modes of work and livelihood;\n\n\nThere is no regard for those with titles; nor are people charmed by the foreign speech;\nthose with no regard for laws are engaged in worship! To the government we complain, only in vain. \n\nForeign cloth makes their blood boil; if it's below par, they treat it with contempt;\noverwhelmed with emotion, they chant 'vandE', and use inappropriate words, in their fury! \n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde. Meaning by Suhasini Jayakumar.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 07/26/2007",
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde. Meaning by Suhasini Jayakumar.',
  },
  {
    id: 'c0042.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '08/25/2007',
    title: 'naaTTilengum',
    raga: ['daNDaka'],
    lyrics:
      '1 nATTilengum svatantra vAncaiyai nATTinAi kanal mUTTinAi\nvATTiyunnai maDakki shiraikkuLLE mATTuvEn vali kATTuvEn\n\n2  kUTTam kUDi vandE mataram enru ghOSittAi emai dUSittAi\nOTTa nAngaLeDukkavenrE kappal OTTinAi poruL ITTinAi\n\n3  kOzhaippaTTa janangaLukkuNmaigaL kUrinAi shattamIrinAi\nEzhai paTTingiratta vizhivenrE EshinAi vIram pEshinAi\n\n4  aDimai bEDigaL nammai manidargaL AkkinAi punmai pOkkinAi\nmiDimai pOdum namakkenriundOrai miTTinAi AshaiyUTTinAi\n\n5  toNDonrE tOzhilAk-koNDirindOraittUNDinAi pugazh vENDinAi\nkaND kaNDa tozhil karkka mArgangaL kATTinAi shOrvaiyOTTinAi\n\n6  enguminda svarAjya viruppattai EvinAi vidai tUvinAi\nsingam sheyyum tozhilai shiru muyal sheyyavO nIngaL uyyavO\n\n7  shuTTu vIzhttiya buddhi varundiDa sholluvEn kuttik-kolluvEn\ntaTTip-pEshuvOruNDO shiraikkuLLE taLLuvEn pazhi koLLuvEn',
    meaning:
      'All over the land, you\'ve kindled this longing for freedom and self-rule,\nI will ensure that you are imprisoned and made to feel the pain\n\nYou chanted "Vande Maataram" in your gatherings, treating us with contempt,\nYou ran ships manned by our people, to take our wealth\n\nYou revealed the truth to the cowardly public, and flaunted the laws\nYou preached bravery in the face of death, to the poor masses\n\nYou turned us from trusting slaves, into human beings, our innocence lost\nYou turned us from our contentment, sparking new desires and wants\n\nYou incited those who were lost in service alone, and sought their praise\nYou showed them very many ways to earn a living, doing anything and everything\n\nYou sowed the seeds of self-government all over this land, with your deeds,\nCould a hare do the work that a lion once did, with your support?\n\nI will proclaim all this, and shame your soul into sadness, thus destroy it,\nWho can gainsay any of this? I will imprison you, and avenge every one here\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 08/25/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0043.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/23/2007',
    title: 'nenju porukkudillaiye',
    raga: ['dvijAvanti'],
    lyrics:
      'pallavi  nenju porukkudillaiyE (en) inda nilai keTTa manidarai ninaindu viTTAl\nanupallavi  anji anji shAvAr ivar anjAda poruLillai avaniyilE\ncaraNam  kanci kuDipadarkillAr adan kAraNangaL ivai ennum ariyumillAr\ntanda poruLaik-koNDE janam tAnguvAr ulagattil arasharellAm\nanda arashiyalai ivar anjutaru pEiyenreNNi nenjam ayarvAr',
    meaning:
      'The heart cannot bear this, my heart cannot \n\nWhen I think of these unsettled masses,  my heart....\n\nThey have not even porridge to drink, yet they know not the reasons\n\n\n\n\n\n\n\nOther information:\n\nLyrics contributed by Lakshman Ragde. Partial meaning by Suhasini Jayakumar.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/23/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde. Partial meaning by Suhasini Jayakumar.',
  },
  {
    id: 'c0044.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/23/2007',
    title: 'nenjukku neetiyum',
    raga: ['sindu bhairavi'],
    lyrics:
      '1 nenjukku nItiyum tOLukku vALum nirainda shuDarmaNIp-pUN\npanjukku nEr pala unbangaLAM ivaL pArvaikku nERperuttI\nvancanaiyinri paghaiyinri shUdinri vaiyaga mAnadarellA\ntanjamenrE uraippIr avaL pEr shakti Om shakti Om shakti OM\n\n2  nalladum tIyadum sheidiDum shakti nalattai namakkizhaippAL\nalladu ningum enrE ulagEzhum araindiDuvAi murashE\n shollat-taghunda poruLanru ingu shollumavar tamaiyE \nallal keDut-tamarak-kiNaiyAkkiDum Om shakti Om shakti Om\n\n3  nambuvadE vazhi yenra maraitannai nAminru nambiviTTOm\nkumbiT-TennEramum shakti enrAlunaik-kumbiDuvEn manamE\nambukkum tIkkum viDattukkum nOvukkum accamilAdapaDi\numbarkkum-i mbarkkum vAzhvu tarumpadam Om shakti Om shakti Om\n\n4  ponnaip-pozhindiDu minnai vaLarttiDu pOTri yunak-kishaindOm\nannai parAshakti enruraittOm taLaiyattanaiyum kaLaindOm\nshonna paDikku naDattiDuvAi manamE tozhil vErillai kAN\ninnum tEyuraippOm shakti Om shakti Om shakti Om\n\n5  veLLai malarmishai vEdak-karupporuLAga viLangiDuvAi\nteLLU kalaittamizh vANi ninakkoru viNNappam sheidiDuvEn\neLLattanaip-pozhudum payaninri-virAdenran nAvinilE\nveLLamenapp-pozhivAi shakti vEl shakti vEl shakti vEL',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde. \n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/23/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0045.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/23/2007',
    title: 'nEram migundadinnum',
    raga: ['nAdanAmakriyA'],
    lyrics:
      '1 nEram mighundadinnum niddiraiyinri ungaL ninaippu teriyavillai kUttaDikkirIr\nshOran urangi vizhu naLLiravinilE enna dULi paDugudaDi ivviDattilE\n Urai ezuppiviDa niccayam koNDIr annai orutti unDenbadaiyu maranduviTTIr\nsara mighundadenru vArttai sholgirIr migha shalipput-tarugudaDi sakhip-peNNgaLE\n\n2  nAnum pala dinangaL poruttirundEn idu nALukku nAL adhikamAgiviTTadE\nkUnan oruvan vandin-nANi pinnalaik-koNDai malar shidari ninrizhuttum\nAnai madam piDittiv-vanciammaiyin aruginil ODa ivan mUrccaiyuTradum\npAnaiyil veNNai muTrum tinru viTTadAl  pAngiyurOginikku nOvu kaNDadum\n\n3  pattini pAnaiyoru paNNai veLiyil pattu shiruvar vandu muttamiTTadum\nnatti maghaLinuk-kOr jyOtiDan vandu nArpadarashar tammai vAkkaLittadum\nkOttuk-kanal vizhiyak-kOvinip-peNNaik-kongattu mULi kaNDu kokkarittadum\nviddaip-peyaruDaiya vINiyavaLum mErkku dishai mozhigaL kaTru vandadum\n\n4  ettanai poigaLaDi enna kadaigaL ennaiyurakkaminri innal sheigirIr\nshaddamiDum kuzhalgaL vINaigaLellAm tALangaLODu kaTTi muDi vaittangE\nmetta veLiccaminriyOr araiviLakkai mErkku shuvarugil vaitta pinnar\nniddirai koL ennait-taniyil viTTE nIngaLellOrum ungaL vIDu shelluvIr\n\n 5 kaNNan urangavoru kAraNamuNDO kaNNanai inniravu kANbaden munnE\npengaL ellOrum avar vIDu shenriTTAr piriyamighunda kaNNan kAttirukkinrAn\nveNkala vANikarin vIdi munaiyil vElip-purattilEnaik-kANaDi yenrAn\nkaNgaL urungavenum kAriyamuNDO kaNNanai kai iraNDum naTTalinriyE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/23/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0046.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/23/2007',
    title: 'ninnai sharaNaDaindEn',
    raga: ['punnAgavarALi'],
    lyrics:
      'pallavi  ninnai sharaN aDaindEn kaNNammA ninna sharaN aDainden\ncaraNam 1 ponnai uyarvaip pugazhai virumbiDum ennai kavalaigaL tinnat tagAdenru \n   caraNam 2  miDimaiyum accamumum Evi en nenjirkkuDimai pugundana konravai pOkkenru \n   caraNam 3  tan sheyaleNNit tavippadu tIrndingu nin sheyal sheidu niraivu perum vaNam \n   caraNam 4  tunbam iniyillai shOrvillai tOrpillai anbu neriyil arangaL vaLarttiDa \n   caraNam 5  nalladu tIyadu nAmariyOmannai nalladu nATTuga tImaiyai OTTuga',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/23/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0047.shtml',
    tala: 'khaNDa aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/23/2007',
    title: 'nirppaduve',
    raga: ['simhEndra madhyamam'],
    lyrics:
      'pallavi  nirppaduvE naDappaduvE parappaduvE nIngaLellAm sorppanam tAnA paladOTra mayakkangaLO\nanupallavi  karpaduvE kETpaduvE karuduvadE nIngaLellAm arpa mAyaigaLO ummuL Azhnda poruLillaiyO\ncaraNam  kANbadellAm maraiyumenrAl maraivadellAm kANbamanrO vIN paDu poyyilE nittam vidhi toDarndiDumO\nkANbaduvE urudi kaNDOm kAnbadalAl urudiyillai kANbadu shaktiyAm inda kATSi nittiyamAm',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/23/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0048.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/23/2007',
    title: 'nittam unai vendi',
    raga: ['cakravAkam'],
    lyrics:
      '1 nittamunai vENDi manam ninaippadellAm nIyap-pittanaippOl vAzhvadilE perumaiyuNDO tiruvE\ncitta urudi koNDirundAr sheigaiyellAmveTrikkoNDE uttama nilai shErvarenrE uyarnda vEdam uraippadellAm\nshutta muzhuppoyyO kAN shuDarmaNiyE tiruvE mettamayal koNDuvittEN mEviDuvAi tiruvE\n\n2  unnaiyanri inbamuNDO ulagamishai vErE ponnai vaDi vEnruDaiyAi puttamudE tiruvE  minnoLitaru \nnanmaNigaL mEDai uyarnda mALikaigaL vannamuDaiya tAmaraippU maNikkaruLamunna shOlaigaLum \nannamtaru nei pAlum atishayamAttaruvAi ninnaruLai vAzhttiyenrum ninaindiruppEn tiruvE\n\n3  AdugaLu-mADugaLum azhaguDaiya pariyum vIDugaLu neDunilamum viraivinilE taruvAi Idu ninakkOr daivamuNDO enakkunaiyanri sharaNamuNDO vADu nilattaik-kaNDirangA mazhaiyinaippOl uLLamuNDO\nnADu maNi shelvamellAm nangaruLvAi tiruvE pIDuDaiya vAnporuLE perum kaniyE tiruvE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/23/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0049.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/25/2007',
    title: 'ninnaiye rathi enru',
    raga: ['shankarAbharaNam', 'sindu bhairavi'],
    lyrics:
      'pallavi  ninnaiyE rati enru ninaikkirEnaDi kaNNammA tannaiyE shashiyenru sharaNameidinEn\ncaraNam 1 ponnaiyE tighartta mEni minnaiyE nighartta kAyar-pinnaiyE nitya kanniyE kaNNammA\n   caraNam 2  mAra nambugaLen mIdu vri vAri vIsha nI kaN pArAyO vandu shErAyO kaNNammA\n   caraNam 3  yAvumE sukha munikkOr IshanAmenakkun tOTram mEvumE ingu yAvumE kaNNammA',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/25/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0050.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/25/2007',
    title: 'Om shakti Om shakti',
    raga: ['kAmbhOji'],
    lyrics:
      'pallavi  Om shakti Om shaki parAshakti Om shakti Om shati Om\nOm shakti Om shakti Om shakti Om shakti Om shakti Om shakti Om\ncaraNam 1 gaNapati rAyan avaniru kAlai piDittiDuvOm guNam uyarndiDavE viDudalai kUDi magizhndiDavE\n   caraNam 2  sholluk-kaDangAvE parAshakti shUrattanangaLellAm vallamai tandiDuvAL parAshakti vAzhiyenrE tudippOm\n   caraNam 3  vETri vaDivElan avanuDai vIrattinaip-pugazhvOm kaTri nillAdE pO paghaiyE tuLLi varugudu vEl\n   caraNam 4  tAmaraip-pUvinilE shrutiyai taniyirunduraippAL bhUmaNit-tALinaiyE kaNNIvoTrip-puNNiyam eidiDuvOm\n   caraNam 5  pAmbut-talaimElE naTam sheyyum pAdattinaip-pugazhvOm mAmpazha vAyinilE kuzhalishai vaNmai\n        pugazhttiDuvOm\n   caraNam 6  shelat-tirumaghaLai dhiDam koNDu cintanai sheidiDuvOm shelvamellAm taruvAL namadoLi dikkanaittum\n        paravum',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/25/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0051.shtml',
    tala: 'catushra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'Om shakti shakti enru',
    raga: ['dhanyAsi', 'pUrvikalyANi'],
    lyrics:
      'pallavi  Om shakti shakti enru shollu keTTa sancalangaL yAvinaiyum kollu\nanupallavi  shakti shakti enru sholli avaL sannidhiyilE tozhudu nillu\ncaraNam 1 Om shaktimishaip-pADal pala pADu shakti shakti enru tALam pODu\nshakti tarum sheigai nilattinilE shiva shaktivenri koNDu kaLittADu\n\n   caraNam 2  Om shaktitanayE sharaNam koLLu enrum shAvinik-korachchamillai taLLU\nshakti pugazhAm-amudaiyaLLu mati tannilinip-pAghumandak-kaLLU\n\n\n   caraNam 3  shakti sheyyum pudumaigaL pEshu nalla shaktiyaTra bEDigaLai Eshu\nshakti tiruk-kOyiluLLamAkki avaLtandidu nark-kumkumattai pUshu\n\n   caraNam 4  shaktiyinai shErnadinda sheigai idai shArndu nirpadE namakkOuygai\nshaktiyenum inbamuLLa poighai adil taNNamudamAri nittam peighai\n\n   caraNam 5   Om shakti shaktiyenru nATTu shiva shaktiyaruL bhUmitanil kATTu\nshakti peTra nalla nilai nirppEr bhuvi jAtigaLellAmm adanaik-kETTu\n\n   caraNam 6  shakti shaktiyenru muzhangu avaL tantaramellAm ulagil vazhangu\nshaktiyaruL kUDi viDumAyin uyir santatamum vAzhudalla kizhakku\n\n   caraNam 7  shaktiyum tozhilgaLaiyeNNu nattam shaktiyuLLa tozhil pala paNNu\nshakti tanaiye izhandu viTTAl ingu shAvinaiyum nOvinaiyum uNNu\n\n   caraNam 8  shaktiyuaruLAlulagi vEru oru sankaTam vandAl iraNDu kUru\nshakti shila shOdanaigaL sheidAl avaL taNNaruLEnra manadu tEru\n\n   caraNam 9  shakti tuNaiyenru nambi vAzhttu shiva shakti tanaiyE aghatti vAzhttu\nshaktiyum shirauumighap-peruvAi shiva shaktiyaruL vAzhgavenru vAzhttu',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0052.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/25/2007',
    title: 'pachai kuzhandaiyaDi',
    raga: ['Ananda bhairavi'],
    lyrics:
      '1 paccai kuzhandaiyaDi eNNirap-pAvaiyaDi candramati ishaikkiniya madu enran iru vizhikkudE nilavu\nnaccut-talai pAmbukkuLLE nalla nAgamaNi ulladenbAr duccappaTTu nenjilE ninran jyOti vaLarudaDi\n\n2  pEccuk-kiDamEdaDi nI peN kulattin veTriyaDi Ascarya mAyaiyaDi enran Ashaik-kumariyaDi\nnIccu nilai kaDanda veLLa nIrukkuLLE vIzhndavar pOL tIccuDarai venravoLi koNDa dEvi ninaivizhindEnaDi\n\n3  nIlak-kaDalinilE ninran nINDa kuzhal tOnrudaDi kOla matiyinilE ninran kuLirnda mukham kANudaDi\njnAla veLiyinilE ninran jnAnavoLi vIshudaDi kAla naDaiyinilE ninran kAdal viLangudaDi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/25/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0053.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/27/2007',
    title: 'pachai maNikkiLiyE',
    raga: [
      'rAgamAlikA',
      'kAmbhOji',
      'vasantA',
      'maNirangu',
      'shuruTTI',
      'kAnaDA',
      'dhanyAsi',
      'mukhAri',
      'shenjuruTTi',
      'bilahari',
      'kEdAram',
    ],
    lyrics:
      '1 rAgA: kAmbhOji\n paccai maNikkiLiyE pAvi enakkE yOgap-piccai aruLiyadAi pEruraiyAi ijjagattil\npUraNamA jnAnap-pugazh viLakkai nATTuvitta bhAratamA dEviyenap-pADu\n\t\t\n2 rAgA: vasantA  tEnAr mozhikkiLLAi dEvi enakkAnandamAnAL ponnATTai arivippAi vAnADu\nbhErimaya vErpumudar-peN kumariyIrAgum ariya nAdenrE ari\n\t\t\t\n3 rAgA:  maNirangu   inmazhalaip-painkiLiyE engaL uyirAnAL nanmaiyura vAzhu nagaredu kol cinmayamE\nnAnenrarindadani periyOrk-kinnamudu tAl enra kAsittalam\n\t\t\t\n4 rAgA:  shuruTTI   vannak-kiLi vandEmAtaram enrOduvarai innalarak-kAppALi yAruraiyAi tannarsheyat-\ntAnbOm vazhiyellAm dhanmamODu pon viLaikkum vAnpOnda gangaiyena vAzhttu\n\t\t\t\n5 rAgA:  kAnaDA   shOlaip-pashum kiLiyE tonmarai nAnguDaiyAL vAlai vaLaru malai kUrAi jnAlattuL\nverpponru-mIDiladAi viNNil muDi tAkkum porpponru veLLai poruppu\n\t\t\n6 rAgA:  dhanyAsi   shIrum shirappum uyar shellamumO-reNNAtrAL uRum puravi uraittAi tErir-\nparimishaiyUr vALallaL pAranaittu-manjum arimishaiyE-yUrvALavaL\n\t\t\t\n7 rAgA:  mukhAri   karuNai uruvAnAL kAindezhungArk-kiLLAisherunarai vIzhttu paDaiyEn ceppAri porubavarmET-\nraNNaNiyAL vizhAdu vizhiTraghaippari tAn tiNNamuru vAnkulisham tEru\n\t\t\t\n8 rAgA:  shenjuruTTi   Ashai marakatamE annai tiru munriliDai Oshai vaLar murasha  m OduvAi pEshugavO\nsattiyamE sheiga dharumamE enroli shei mutti tarum vEda murashu\n\t\t\t\n9 rAgA:  bilahari   vArAyiLancukamE vandip-pArkkenrumiDar tArAL punaiyumaNittAr kUrAi shErArai\nmuTrAk-kuru naghaiyAl muTruvittum tAnoLirvAL poTrAmaraittAr punaindu\n\t\t\t\n10 rAgA:  kEdAram   koDippavaLa vAikkiLLAi kuttiramum tIngum maDippavaLin vEl koDi tAn maTrEn aDippaNivAr\nnanrArat-tIyAr naliyuravE vIshum oLi kunrA vayirak-koDi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/27/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0054.shtml',
    tala: 'tishram',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/27/2007',
    title: 'paghaivanukku aruLvAi',
    raga: ['rAgamAlikA'],
    lyrics:
      'pallavi  paghaivanuk-karuLvAi nannenjE paghaivanuk-karuLvAi\ncaraNam 1 pughai naDuvinil tIyiruppadaip-bhUmiyir-kaNDOmE nannenjE bhUmiyir-kaNDOmE\npaghai naDuvil anburuvAnarum paraman vAzhginrAn nannenjE paraman vAzhgirAn\n    caraNam 2  shippiyilE nalla muttu viLaindiDum sheidi ariyAyO nannenjE\n kuppaiyilE malar konjum kurukkattik-koDi vaLarAdO nannenjE\n   caraNam 3  uLLa niraivilOr kaLLam pughundiDil uLLa niraivAmO nannenjE\nteLLiya tEnilOr shiridu nanjaiyum shErtapin tEnAmO nannenjE\n   caraNam 4  vAzhvai ninaittapin tAzhvai ninaippadu vAzhuvkku nEramO nannenjE\ntAzhvu pirarkkeNNa-tAnazhiyAn enra shAttiram kELAyO nannenjE\n   caraNam 5  pOrukku vandangu edirtta kauravar pOla vandAnumavan nannenjE\ntEruk-karjunan tErirk-kashai koNDu ninradum kaNNanenrO nannenjE\n   caraNam 6  tinna varum puli tannaiyum anbODu cintaiyil pOTriDuvAi nannenjE\nannai parAshakti avvuruvAyinaL avaLaik-kumbiDuvAi nannenjE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/27/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0055.shtml',
    tala: 'tishram',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '09/27/2007',
    title: 'paarukkuLLE nalla naadu',
    raga: ['hindustAni tODi'],
    lyrics:
      'pallavi  pArukkuLLE nalla nADu engaL bhArata nADu\ncaraNam 1 jnAnattilE para mOnattilE uyar mAnattilE anna dAnattilE\n gAnattilE amudAga nirainda kavitaiyilE uyar nADu indap-\n\n   caraNam 2  dhIrattilE paDai vIrattilE nenjil IrattilE upakArattilE\nsArattilE mighu shAttiram kaNDu taruvadilE uyar nADu indap-\n\n   caraNam 3  nanmaiyilE uDal vanmaiyilE shelvap-panmaiyilE marat-tanmaiyilE\npon mayilottiDu mAdartam karppin pugazhinilE uyar nADu indap-\n\n   caraNam 4  AkkattilE tozhil UkkattilE puya vIkkattilE uyar nOkkattilE\nkAkkat-tiral koNDa mallartam shenaik-kaDalinilE uyar nADu indap-\n\n   caraNam 5  vaNmaiyilE ulAt-tiNmaiyilE manat-tanmaiyilE mati nuNmaiyilE\nuNmaiyilE tavarAda pulavar uNarvinilE uyar nADu indap-\n\n   caraNam 6  yAgattilE tava vEgattilE tani yOgattilE pala bhOgattilE\nAgattilE deiva bhati koNDAr tam aruLinilE uyar nADu indap-\n\n   caraNam 7  ATRinile shunayUTrinilE tenral kATrinilE malaip-pETrinilE\nETrinilE payan IndiDunkAli inattinilE uyar nADu indap- \n\n   caraNam 8  tETTattilE marak-kUTTattilE kani ITTattilE payir UTTattilE\ntETTattilE aDangAda nadiyin shirappinilE uyar nADu indap-',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 09/27/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0056.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'paayum oLi',
    raga: ['AbhOgi'],
    lyrics:
      '1 pAyum oLi nI enakku pArkkum vizhi nAn unakku tOyum madu nI enakku tumbiyaDi nAnunakku\nvAyuraikka varugudillai vAzhi ninran mEnmaiyellAm tUya shuDar vAnoLiyE shUraiyamudE kaNNammA\n2  vINaiyaDi nI enakku mEvum viral nAnunakku pUNum vaDam nI enakku pudu vayiram nAnunakku\n kANumindOru ninran kaNNin oLi vIshudaDi mANuDaiya pErarashE vAzhvu nilaiyE kaNNammA\n3  vAna mazhai nI enakku vaNNa mayil nAnunakku pAnamaDi nI enakku bhANDamaDi nAnunakku\njnAna oLI vIshudaDi nangai ninran jyOti mukham Unamaru nallazhagE Uru shuvaiyE kaNNammA\n4  veNNIlavu nI enakku mEvu kaDal nAnunakku paNNU gati nI enakku pATTinimai nAnunakku\neNNi eNNI pArtiDilOr eNNamilai nin shuvaikkE kaNNin maNi pOnravaLE kaTTi amudE kaNNammA\n5  vIshu kamazh nI enakku viriyu malar nAnunakku pEshu poruL nI enakku pENu mozhi nAnunakku\n nEshamuLLa vAn shuDarE ninnazhagai EduraippEn Ashai madhuvE kaniyE aLLu shuvaiyE kaNNammA\n6  kAdalaDi nI enakku kAntamaDi nAnunakku vEdamaDi nI enakku viddaiyaDi nAnunakku\nbOdhamuTra pOdinilE pongi varum tIn-shuvaiyE nAda vaDivAnavaLE nalla uyirE kaNNammA\n7  nalla uyir nI enakku nADiyaDi nAnunakku shelvamaDi nI enakku kSEma nidhi nAnunakku\nellaiyaTra pErazhagE engum nirai pork-kaDarE mullai nigar punnakaiyAi pOdum inbamE kaNNammA\n8  tAraiyaDi nI enakku taNmatiyam nAnunakku vIramaDi nI enakku veTriyaDi nAnunakku\ndAraNiyil vAnulagil shArndirukkum inbamellAm oruvarumAi samaindAi uLLamudE kaNNammA',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0057.shtml',
    tala: 'roopakam',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/02/2007',
    title: 'pEyaai uzhalum',
    raga: ['vInadhAri'],
    lyrics:
      'pallavi  pEyAi uzhalum shiru manamE pENAi enshol inru mudal\nanupallavi  nIyAi onrum kELAdE ninadu talaivan yAnE kAN\ncaraNam  tAyAm shakti tALinilE dharumamenyAn kurippaduvum\nOyAdE ninru uzhaittiDuvOm uraittEn aDangi uyyudiyAi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/02/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0058.shtml',
    tala: 'roopakam',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/02/2007',
    title: 'pEyavaL kaaN',
    raga: ['AbhOgi'],
    lyrics:
      '1 pEyavaL kAN engaL annai perum pittuDaiyAL engaL annai\nkAyazhal Endiya pittan tanaik-kAdalippAL engal annai\n\n2  innishaiyAm inbakkaDalil ezhundu Etrum alaittiraL veLLam\ntanniDam mUzhgit-tiLaippAL angut-tAvik-kudippAL em annai\n\n3  tInshork-kavitaiyanshOlai tanil deivika nanmaNam vIshum\ntEnshori mAmalar shUDi maduttEkku naDippAL em annai\n\n4  vEdangaL pADuvAL kANIr uNmai vEngayirp-paTrik-kudippAl\nOdarum shAttiram kOTi uNarndOdi ulagengum vidaippAL\n\n5  bhAratap-pOrenil eLidO virarp-pArthan kai villiDai oLirvAL\nmAradar kOTi vandAlum kaNam vAittuk-kurudiyil tiLalippAL',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/02/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0059.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/02/2007',
    title: 'piLLai praayattilE',
    raga: ['saraswati manOhari', 'shrI', 'punnAgavarALi'],
    lyrics:
      '1 raagam: saraswati manOhari\n\n\n\n\n28 harikAmbhOji janya\nAa: S R2 G3 M1 D2 S\nAv: S D2 N2 P M1 G3 R2 S\n piLLai prAyattilE avaL peNmaiyaik-kaNDu mayangi viTTEnangup-paLLippaDippinilE\n mati paTriDavillai enilumtanippaDa vELLai malaraNaipOl avaL vINaiyum kaiyum virinda\n mukhamalar viLLum poRuLamudum kaNDu veLLai manadu parikoDuttEnammA    \n\n2  ADi varugayilE avaL angoru vIdi munaiyirppAL kaiyil Edu tarittiruppAL adil\ningitamAghap-padam paDippAL adai nADi arugaNaindAl pala jnAnangaL sholli inimai\n sheivAL inru kUDi magizhva menrAl vizhik-kONattilE naghai kATTi shelvALammA\n\n3  Atram karai tanilE taniyAnadOr maNTapamIdinilE tenral kATrai nugharndirundEn\n anguk-kannik-kavitai koNarndu tandAL adai Etru manamagizhndE aDi ennODiNangi\n maNam purivAi enru pOTriya pOdinilE iLam punnakai pUttu maraindu viTTALammA\n\n4  cittam taLarndaduNDO kalai dEviyinmIdu viruppam vaLarndoru pittu piDittadu pOl\npagharp-pEccumiravira kanavum avaLiDai vaitta ninaivaiyallAl pira vAncaiyuNDO \nvayadanganamE iru pattiranDAmaLavum veLLaippaNmaghaL kAdalaip-paTri ninrEnammA \n\t\t\t\t\n\n5 raagam: shrI\n\n\n22 kharaharapriya janya\nAa: S R2 M1 P N2 S\nAv: S N2 P D2 N2 P M1 R2 G2 R2 S\n\n  inda nilaiyinilE angOr inbap-pozhiliniDaivinil vEroru sundari vandu ninrAL avaL\njyOti mukhattin azhagaik-kaNDenran cintai tirai koDuttEn avaL shen tiruvenru peyar shollinAL\nmaTrum anda dinamudalA nenjam Arat-tazhuviDa vENDuginrEnammA\n\n 6  punnakai sheidiDuvAL aTraippOdu muzhudu magizhndiruppEn shaTren munninru pArttiDuvAL\n anda mOhattilE talai shuTrik-kAN pinnarenna pizhaigaL kaNDO avaL ennai purakkaNit-tEgiDuvAL\nangu cinnamum bhinnamumA manam siddhiyuLamigha nondiDuvEnammA\n\n7 kATTu vazhigaLilE malaik-kATSiyilE punal vIzhcciyilE pala nATTuppurangaLilE nagar\n naNNu shila shuDar mADattilE shila vIrariDattilum vEndariDattilum mITTum avaL varuvAL\nkaNDa vindaiyilE inbamErkkoNDu pOmammA\n\n\n8 raagam: punnAgavarALi\n\n8 hanumatODi janya\nAa: N2 , S R1 G2 M1 P D1 N2\nAv: N2 D1 P M1 G2 R1 S N2\n\n  pinnO nirAvinilE karum peNmai yazhagonru vandadu kaN munbu kanni vaDivamenrE\nkaLi kaNDu shaTrE arugil shenru pArkkaiyil annai vaDivamaDA ivaL Adi parAshakti\ndEviyaDA ivaL innaruL vENDumaDA pinnar yAvumulagil vashappaTTu-pOmaDA\n\n9  shelvangaL pongivarum nalladen-nariveidi nalam pala shArndiDum allum paghalum\n ingE ivai attanai kOTip-poruLinuLLE ninru villai ashaippavanai inda vElaiyanaittum\nsheyyum vinaicciyait-tollai tavirppavaLainittam tOttiram pADit-tozhudiDuvOMaDA',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/02/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0060.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/07/2007',
    title: 'ponnavir mEni',
    raga: ['punnAgavarALi'],
    lyrics:
      '1 ponnavie mEni subadhrai mAdai puramkoNDu pOvadarkkE ini\nenna vazhiyenru kETkilupAyam iru kaNattEyuraippAn andak-\nkaNNan villALar talaivanaik-konriDak-kANum vazhiyonrillEn vanding-\nunnai aDaindavan ennilupAyam oru kaNattEyuraippAn\n\n2  kAnakattE shuTru nALilu nenjirk-kalakkamillAdu sheivAn perum\nshEnait-talai ninru pOr sheyyum pOdinil tEr naDattik-koDuppAn enran\nUnai varundiDu nOi varum pOdinil uTra marundu sholvAn nenjam \nInak-kavalaigaLeidiDum pOdil hitam sholli mATriDuvAn\n\n3  pizhaikkum vazhi sholla vENDumenrAloru pEccinilE sholluvAn\nuzhaikkum vazhivinaiyALum vazhi payan uNNum vazhiyuraippAn\nazhaikkum pOdinirp-pOkku shollAmal arai noDikkuL varuvAn\nmazhaikkuDai pashi nErat-tuNaivenran vAzhvinuk-kengaL kaNNan\n\n4  keTTa pozhudil poruL koDuppAn shollum gEli porundiDuvAn enai\nATTangaL kATTiyum pATTugaL pADiyum Arudal sheidiDuvAn enran\nnATTattirk-koNDa kurippinai ihdenru nAn shollu munnuravAn anbar\nkUTTattilE indak-kaNNanaip-pOl anbu koNDavar vEruLarO\n\n5  uLlattilE garvam koNDa pOdinil Ongi aDittiDuvAn nenjil\n kaLLattai koNDoru vArttai shonnAlangu kAri umizhdiDuvAn shiru\npaLLattilE neDunALum keTTa pAshiyai EtriDum peru\nveLLattaip-pOlaruL vArtaigaL sholli melivu tavirttiDuvAn\n\n6  cinnak-kuzhandaigaL pOl viLaiyADi shirittuk-kaLittiDuvAn nalla \nvanna maghaLir vashappaDavE palamAyangaL shUzndiDuvAn avan\nshonnapaDi naDavAviDilO mighat-tollai izhaittiDuvAn kaNNan\ntannai izhanduviDil ayyakO pin sukhattinil vAzhvadilEn\n\n7  kOpattilE oru sholvil shirittuk-kulungiDa sheidiDuvAn mana-\nsthApattilE onru sheidu magizhcci taLirttiDa sheidiDuvAn perum\nAbattinil vandu pakkattilE ninradanai vilakkiDuvAn shuDar\ndIpattilE vizhum pUccigaL pOl varum tImaigaL konriDuvAn\n\n8   unnait-tavari naDappavar tammai udaittu nashukkiDuvAn aruL\nvaNmaiyinAl avan mAttiram poigaL malai malaiyA uraippAn nalla\npeNmai guNamuDaiyAn shila nErattir pittar guNamuDaiyAn mighat-\ntaNmai guNamuDaiyAn shila nEram tazhalin guNamuDaiyAn\n\n9  kollum kolaik-kanjiDAda maravar guNa mighattAnuDaiyAn kaNNan\nshollu mozhigaL kuzhandaigaL pOloru shUdariyAdu sholvAn enrum\nnallarukkoru tIngu naNNAdu nayamurak-kAttiDuvAn kaNNan\nallavarukku viDattinil nOyil azhalinum koDiyAn\n\n10  kAdal viLaya mayakkiDum pATTinil kaNmagizh chittirattil paghai\nmOdum paDaittozhil yAvinumE tiramuTriya paNDitankAN uyar\nvEdamuNarnda munivar uNarvinilmEvu param poruLkAN nalla\ngItaiyuraittenai inbura sheidavan kIrtigaL vAzhttiDuvEn',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0061.shtml',
    tala: 'roopakam',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/07/2007',
    title: 'pooTTai tirappadu',
    raga: ['Ahiri'],
    lyrics:
      'pallavi  pUTTai tirappadu kaiyAlE  nalla manattirappadu matiyAlE\nanupallavi  pAttai tirappadu paNNAlE inba vITTai tirappadu peNNAlE\ncaraNam 1 Ettai tuDaippadu kaiyAlE mana vITTai tuDaippadu meyyAlE\nvETTai aDippadu villAlE anbuk-kOTTai piDippadu shollAlE\n   caraNam 2  kATrai aDaippadu manadAlE indak-kAyattai kAppadu sheigaiyAlE\nshOTraip-pushippadu vAyAlE uyir tuNivuruvadu nAyAlE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0062.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/07/2007',
    title: 'saattirangaL pala',
    raga: ['punnAgavarALi'],
    lyrics:
      '1 sAttirangaL pala tEDinEn angu shangaiyillAdana shangaiyAm pazham\ngOttirangaL shollumuDar tam poimaik-kUDaiyil uNmai kiDaikkumO nenjil\nmAttiramenda vaghaiyilum sukha mAyam uNarndiDal vENDum ennum\nAttira ninradidaniDai nittam Ayiram tollaigaL shUzhndana\n\n2  nADu muzhudilum shuTri nAn pala nATkaL alaindiDum pOdinil nirain-\ndODum yamunaik-karaiyinilE taDi Unri shenrOr kizhavanAr oLi\nkUDu mukhatteLivu tAn kuDi koNDa vizhiyum shaDaigaLum veLLai\ndADiyum kaNDu vaNangiyE pala sangati pEshi varugaiyil\n\n3  ennuLLattAshai arindavar migha inbuTrurattiDal Ayinar nambi\nninnaruLattirrk-kughandavan shuDar nittya mOnat-tiruppavan uyar\nmannar kulattirp-pirandavan vaDa mAmaduraip-patiyALginrAn kaNNan\ntannai sharaNenru pOvaiyAl avan sattiyam kUruvan enranar\n\n4  mA maduraipati shenrutAn angu vAzhginra kaNNanaip-pOTriyE enran\nnAmamu mUrum karuttumE sholli nanmai tarugena vENDinan avan\nkAmanaip-pOnra vaDivamum iLam kALaiyar naTpum pazhakkamum keTTa\nbhUmiyaik-kAkkum tozhililE endap-pOdum sheluttiDum chintaiyum\n\n5  Adalum pADalum kaNDu nAn munnar ATRam karaiyinil kaNDadOr muni\nvEDam taritta kizhavarai k-kolla vENDumenruLLattil eNNinEn shiru\nnADu purandiDu mannavan kaNNan nALum kavalaiyil mUzhginOn tavap-\npADu paTTOrkkum viLangiDA uNmai pArthiban enganM kUruvAn\n\n6  enru karudi iruttiTTEn pinnar ennait-taniyiDam koNDu pOi ninai\nnanru maruvuga maindanE para jnAnam uraittiDak-kETpai nI nenjil\nonrum kavalaiyillAmalE chintai Unra niruttik-kaLippuTrE tannai\nvenru marandiDum pOzhdinil angu viNNai aLakkum arivu tAn\n\n7  chandiran jyOtiyuDaiyadAm adu sattiya nittiya vastuvAm adai\nchintikkum pOdinil vandu tAn ninai shErndu tazhuvi aruL sheyum adan\nmantirattAl ivvulagellAm vanda mAyak-kaLipperum kUTTuk-kAN idai\nsantatam poyyenruraittiDum matha sAttiram poi enru taLLaDA\n\n8  Adit0tanip-poruLAgumOr kaDal Arum kumizhi uyirgaLAm anda\njyOti arivenru nyAyiru tannai shUzhnda kadirgaL uyirgaLAm ingu\nmIdip-poruLgal evaiyumE adan mEniyil tOnriDum vaNNangaL vaNNa\nnIti arindainbam eidiyE oru nErmait-tozhilil iyanguvAr\n\n9  cittattilE shivan AduvAr ingu shErndu kaLIttu ulagALuvAr nalla\nmatta mataven-kaLirupOl naDai vAindiru mAndu tiriguvAr ingu\nnitta nigazhvanaittumE endai tINDa tiruvaruLAl varum inbam\nshuddha sukham taniyAnandam ena shUzhndu kavalaigaL taLLiyE\n\n10  jyOti arivil viLangavum uyar shUzcci matiyil viLangavum ara\nnIti murai vazhuvAmalE enda nEramum bhUmit-tozhil sheidu kalai\nOdip-poruLiyal kaNDu nAm pirar uTriDum tollaigaL mATriyE inbam\nOdi vizhikkum vizhiyinAr peNmai mOhattil shelvattil kIrtiyil\n\n11 Adudal pADudal cittiram kaviyAdi inaiya kalaigaLil uLLam\nItpaTTenru naDappavar pirar hIna nilai kaNDu tuLLuvAr avar\nnADum poruLgaL anaittaiyum shila nALinil eidap-peruguvAr avar\nkADu puridal vanarinum deivak-kAvan menradaip-pOTralAm\n\n12  jnAniyar tammiyal kUrinEn anda jnAnam viraivinileiduvAi enat\ntEnil iniya kuralilE kaNNan cheppavu muNmai nilai kaNDEn paNDai\nhIna manidark-kanavellAm engaL Eghi maraindadu kaNDilEn ari-\nvAna taniccuDar nAn kaNDEn adan Adal ulagena nAn kaNDEn',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0063.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/07/2007',
    title: 'shaagaa varam',
    raga: ['dharmAvati', 'varam'],
    lyrics:
      'pallavi  shAgA varam aruLvAI rAmA catur marai nAthA sarOja pAdA\ncaraNam 1 AkAshat-tIkAl nirmaN attanai bhUtamum ottu niraindAi\nEkAmirtamAghiya ninnAL iNai sharaNenrAl idu muDiyAdA\n\ncaraNam 2  vAgAr tOL vIrA dhIrA manmata rUpA vAnavar bhUpA\npagArmozhi sItaiyin menrOn pazhagiya mArbA padamavar shArbA\n\ncaraNam 3 nityA nirmalA rAmA niSkaLankA sarvA dhArA\n satyA sadAnandA rAmA sharaNam sharaNam sharaNam udArA',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0064.shtml',
    tala: 'tishra aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/07/2007',
    title: 'shenradini meeLaadu',
    raga: ['shankarAbharaNam'],
    lyrics:
      'pallavi  shenradini mILAdu mUDarE nIr eppozhudum sherAdaiyE eNNi eNNi\nanupallavi  konrazhikkum kavalai enum kuzhiyil vIzhndu kumaiyAdIr sheradinai kurittal vENDA\ncaraNam  inru pudidAi pirandOm enru nIvIr eNNamadil tiNNamura ishaittuk-koNDu\ntinru viLaiyADi inbuTrirundu vAzhvIr tImaiyelAm azhindupOm tirumbivArA',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0065.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'shendamizh naaDennum',
    raga: ['kAmbhOji', 'pUrvikalyANi', 'mOhanakalyANi'],
    lyrics:
      '1 shentamizh nADennum pOdinilE inba tEn vandu pAyudu kAdinilE engaL\ntandaiyar nADenra pEcchinilE oru shakti pirakkudu mUcchinilE (shentamizh)\n\n2 vEdam nirainda tamizh nADu uyar vIram sherinda tamizh nADu nalla\nkAdal puriyum arampayar pOliLan-kanniyar shUzhnda tamizh nADu (shentamizh)\n\n3 kAviri ten peNNai pAlAru tamizh kaNDadOr vaighai porunai nadi ena\nmEviya yAru palavODat tiru mEni shilirtta tamizhnADu (shentamizh)\n\n4 muttamizh mAmuni nILvaraiyE ninru moympurak kAkkum tamizhnADu shelvam\nettanaiyuNDu bhuvimIdE avai yAvum paDaitta tamizhnADu (shentamizh)\n\n5 nIlat tiraikkaDa-lOrattilE ninru nittan tavam sheyyum kumariyellai vaDa\nmAlavan kunram ivaTriDaiyE pugazh maNDik kiDaikkum tamizhnADu (shentamizh)\n\n6 kalvi shiranda tamizh nADu pugazhk kamban piranda tamizh nADu nalla\npalvida-mAyina shAttirattin maNam pArengum vIshum tamizhnADu (shentamizh)\n\n7 vaLLuvan tannai ulaginukkE tandu vAnpugazh koNDa tamizh nADu nenjai\naLLum shilappaddhikAramen-rOr maNiyAram paDaitta tamizhnADu (shentamizh)\n\n8 shingaLam puTpagham shAvakamAdiya tIvu palavinunj shenrEi angu\ntangaL pulikkoDi mInkoDiyum ninru shAlpurak kaNDavar tAinADu (shentamizh)\n\n9 viNNai iDikkum talaiyimayam enum verpaiyaDikkum tiranuDaiyAr ssamar\npaNNik kalingat tiruL keDuttAr tamizhp pArttivar ninra tamizhnADu (shentamizh)\n\n10  shIna mishiram yavanaragam innum dEsham palavum pugazh vIshak kalai\njnAnam paDaittozhil vANibhamum migha nanru vaLartta tamizh nADu (shentamizh)',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0066.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'sholla vallaayO',
    raga: ['behAg', 'kIravANi'],
    lyrics:
      'pallavi  sholla vallAyO kiLiyE sholla nI vallAyO\nanupallavi  valla vEl murugan tanai ingu vandu kalandu magizhndu kulAvenru\ncaraNam 1 tilla ambalattE naTanam sheyyum amarar pirAn avan\nshelvat-tirumaghanai ingu vandu shErndu kalandu magizhndiDuvAi enru\n\n   caraNam 2  allik-kuLattarugE oru nAL andip-pozhudinilE angOr\nmullai sheDi adanpAr sheida vinai muTrum marandiDak-kaTradennE enru\n   caraNam 3  pAlai vanattiDaiyE tanai kaip-paTri naDakkaiyilE tan kai\nvElin mishaiyANai vaittu shoonna vindai mozhigaLai cintai sheivAi enru',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0067.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/07/2007',
    title: 'shuttum vizhi shudar',
    raga: ['shenjuruTTi'],
    lyrics:
      '1 shuTTum vizhi shuDar tAn kaNNammA sUriya candirarO vaTTak-kariya vizhi kaNNammA vAnakkarumai kollO\npaTTuk-karunIlap-puDavai paditta nal vayiram naTTa naDu nishiyil teriyum nakSattirangaLaDi\n\n2  shOlai malaroLiyO unadu sundarap-punnakai tAn nIlak-kaDal alaiyE unadu nenji valaigaLaDi\nkOlak-kuyilOshai unadu kural-inimaiyaDi vAlaik-kumariyaDi kaNNammA maruvak-kAdal koNDEn\n\n3  shAttiram pEshugirAi kaNNammA shattiramEdukkaDi Attiram koNDavarkkE kaNNammA shAttiramuNDODi\nmuttavar sammadiyil vadhuvai muraigaL pinbu sheivOm kAttiruppEnODi idu pAr kannattu muttamonru',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0068.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/19/2007',
    title: 'taka taka taka',
    raga: ['behAg'],
    lyrics:
      'pallavi  takat takat takat takatakavenrADOmO shiva shakti shaktiyenru pAdOMO\ncaraNam 1 agatta shuddagattinilE uLninrAL avaL ammaiyammai emmainADu poivenrAL\ntakat taka namakkaruL purivAL tAlonrE sharaNamenru vAzhndiDuvOm nAmenrE\n\n   caraNam 2  pughappu kappukavinbamaDA pOdellAm purattinilE taLLiDuvAi shUdellAm\nguhaikku engE irukkudaDA tI pOla adu kuzhandai adan tAyaDikkIzh pOi pOlE\n\n   caraNam 3  mighanda kaippaDu kaLiyinilE meishOra un vIram vandu shOrvai venru kaitEra\njagattiluLLa manidarellAm nanru nanrena nAm shadiruDanE tAnamishai piraNDumonrEn\n\n   caraNam 4  indiranAr-ulaginilE nallinbam irukkudenpAr adanai ingE koNDEidi\nmantiram pOl vENDumaDA shollinbam nallamadamuravE amuda nilai kaNDEidit-',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/19/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0069.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'tanjam ulaginil',
    raga: ['punnAgavarALi'],
    lyrics:
      '1 tanjamulaginil engaNuminri-tavittut-taDumAri panjaipparaiyanaDimai\npughundEn bhAramunakkANDE ANDE bhAramunakkANDE\n2  tunbamu nOyu miDimaiyum tIrttu sukahm aruLa vENDum anbuDalin\npugazh pADi kudittu nin Anai vazhi naDappEn ANDE ANai vazhi naDappEn\n\n3  cEri muzhudum paraiyaDittE aruT-siddhigaL pADiDuvEn bhErikai koTTi\ndishaigaL adira nin peyar muzhakkiDuvEn ANDE peyar muzhakkiDuvEn\n\n4  paNNaip-paraiyar tam kUTTattilE ivan bhAgyam Ongi viTTAln kaNNan\naDimaiyil ivanum kIrtiyil kAdaluTringu vandEn ANDE kAdaluTringu vandEn\n\n5  kADu kazhanigaL kAttiDuvEn ninran kAligaL meittiDuvEn pADu paDa shollip-\npArttadan pinnaren pakkuvam shollANDE ANDE pakkuvam shollANDE\n\n6  tOTTangal kotti sheDi vaLarkka sholli shOdanai pODANDE kATTu mazhaikkuri\ntuppi shonnAvenaik-kaTTiyaDi ANDE AnDE kaTTiyaDi ANDE\n\n7  peNDu kuzhandaigaL kanji kuDittup-pizhaittiDa vENDumaiyE aNDAiyayalaluk-\nkennAlupakArAngaL AgiDa vENDumaiyE upakArangaL AgiDa vENDumaiyE\n\n8  mAnattak-kAkkavOr nAlu muzhattuNi vAngit-tara vENum dAnattukku shila\nvETTigaL vAngit-taravum kaDan ANDE shila vETTi taravum kaDan ANDE\n\n9  onbadu vAyirk-kuDivinai shuTri oru shila pEigaL vandE tunbap-paDuttudu\nmantiram sheidu tolaittiDa vENDumaiyE paghai yAvum tolaittiDa vENDumaiyE\n\n10  pEyum pishAshum tiruDanum enran peyarinai kETTaLavil vAyum kaiyum\nkaTTi anji naDakka vazhi sheyya vENDumaiyE tollai tIrum vazhi sheyya vENDumaiyE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0070.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'tEDi shOru nidam',
    raga: ['sahAnA'],
    lyrics:
      'pallavi  tEdi shOru nidam tinru pala cinnam shiru kadaigaL sholli\nanupallavi  vADit-tunbamigha uzhanru (manam) pirar vADap-pala sheyalgaL sheidu\ncaraNam  kUDik-kizhapparuvam Eidi narai (koDum) kUTRukkiraiyenappin mAyum\nvEDikkai manidaraip-pOlE nAn vIzhvEnenru ninaittAyO',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0071.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/11/2007',
    title: 'thee vaLarthiDuvOm',
    raga: ['punnAgavarALi'],
    lyrics:
      'pallavi  tI vaLarttiDuvOm peru tI vaLarttiDuvOm\n\n1 AviyinuLLum ariviniDaiyilum anbai vaLarttiDuvOm viNNin\n Ashai vaLarttiDuvOm kaliyAval vaLarttiDuvOm oru \ndEvi maghanait-tiramaik-kaDavuLai shen kadir vAnavanai viNNOm tamait\ntEnukkazhaippavanaip-prrum tiran shErndau paNindiDuvOm vArIr\n\n2  cittat-tuNivinai mAnuDar kELvanait-tImai vazhippavanai nanmai\n shErndu koDuppavanai pala shIrgaLuDaiyavanai bhuvi\n attanaiyum shuDar Erat-tigazhndiDum Ariyar nAyakanai uruddiran\n anbuttirumaghanai perum tiravAgip-paNinidiDuvOm vArIr\n\n3  kaTTugaL pOkki viDudalai tandiDum kaNmaNi pOnravanai emmaik-\nkAval puribavanait-tollaik-kATTai azhippavanai dishai\neTTum pugazh vaLarttOngiDa viddaigaL yAvum pazhagiDavE bhuvimishai\ninbam perugiDavE perum tiran eidip-paNindiDuvOm vArIr\n\n4  nenjirk-kavalaigaL nOvugaL yAvaiyum nIkkik-koDuppavanai uyir \nnILattirubavanai oLir nErmaip-perum kanalai nittam\nanjal anjal enru kUri emakku nallANmai shamaippavanaip-palveTrigaL\nAkkik-koDuppavanaip-perum tiran aghip-paNindiDuvOm\n\n5  accattai kaTTangu shAmbaruminri azhittiDum vAnavani shegai\nAtrumaticcuDarait-taDaiyaTra perum tiralai emmun\nIccaiyum vETkaiyum Ashaiyum kAdalum eTradOr nallaramum kalandoLi\nErum tavakkanalaip-perum tiran eidip-paNindiDuvOm vArIr\n\n6  vAnagattai shenru tINDuvaningenru maNDi ezundazhalaik-kavi\nvANarkku nallamudait-tozhil vaNNam terindavanai nalla\ntEnaiyum pAlaiyum neyyaiyum shOTraiyum tImpazham yAvinaiyum ingEyuNDu\ntEkkik-kaLippavanaip-perum tiran shErndu paNIndiDuvOm vArIr\n\n7  cittira mALigai ponnoLir mADangaL dEvattirumagaLir inbat-\ntEkkiDum tEnishagaL shuvai tEriDu nalliLamai nalla\nmuttu mANigaLum ponnu nirainda muzhukkuDam parppalavum ingE tara\nmurppaTTu nirppavanaip-perum tiran moittup-paNindiDuvOm vArIr',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/11/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0072.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/29/2007',
    title: 'teerthak-karaiyinilE',
    raga: ['shenjuruTTi'],
    lyrics:
      '1 tIrthak-karaiyinilE terkku mulaiyil sheNbagat-tOTTattilE\npArttirundAl varuvEn veNNilAvilE pAngiyODenru shonnAi\nvArttai tavari viTTAi aDi kaNNammA mArbu tuDikkudaDi\npArtta viDattilellAm unnaip-pOlavE pArvai teriyudaDi\n\n2  mEni kodikkudaDi talai shuTriyE vEdanai sheigudaDi\nvAni viDattaiyellAm inda veNNilA vandu tazhuvudu pAr\nmOnattirukkudaDi inda vaiyagham mUzhgit-tuyilinilE\nnAnoruvan maTTilum pirivebadOr narakat-tuzhaluvadO\n\n3  kaDumai-yuDaiyadaDi enda nEramum kAvalum mALigaiyil\n aDimai pughunda pinnum eNNUmpOdu tAn angu varuvadarkkillai\nkoDumai porukkavillai kaTTum kAvalum kUDik-kiDakkudangE\nnaDumai arashiyavaL edarkkAghavO nANik-kulaittiDuvAL\n\n4  kUDip-piriyAmalE Or-iravellAm konjik-kulavi angE\nAdi viLaiyAdiyE unran mEniyai Ayiram kOTi murai\nnADit-tazhuvi manakkurai tIrndu tAn nalla kaLi eidiyE\npADip-paravashamAi nirkkavE tavam paNNIyadillayODi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/29/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0073.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/29/2007',
    title: 'tooNDirp-puzhuvinaippOl',
    raga: ['shenjuruTTi'],
    lyrics:
      '1 tUNdirp-puzhuvinaippOl veLiyE shuDar viLakkinaippOl nINDa pozhudAga enadu nenjam tuDittadaDi\nkUNDu kiLiyinaippOl tanimai koNDu mighavu nondEn vENDum poruLaiyellAm manadu veruttu viTTadaDi\n\n2  pAyin mishainAnum taniyE paDuttirukkaiyilE tAyinak-kaNDAlum sakhiyE shalippu vandadaDi\nvAyinil vandadellAm sakhiyE vaLarttu pEriDuvIr nOyinai-pOl anjinEn sakhiyEn UngaL uravaiyellAm\n\n3  uNavu shellavillai sakhiyE urakkam koLLavillai manam virumbavillai sakhiyE malar piDikkavillai\ngunam urudiyillai edilum kuzhappam vandadaDi kaNamu muLLattilE sukhamE kANak-kiDaittadillai\n\n4  pAlum kashandadaDi sakhiyE paDukkai nondadaDi kOlak-kiLi mozhiyum sheviyil kuttaleDuttadaDi\nnAlu vaiddiyarum inimEl nambudarkkillaiyinrAr pAlattu jOsiyanum  graham paDuttu menruviTTAn\n\n5  kanavu kaNDadilE oru nAL kaNNUkku tOnrAmal inam viLangavillai evanO ennaghattoTTu viTTAn\nvinavak-kaN vizhittEn sakhiyE mEni marainduviTTAn manadil maTTilumE puridOr magizcci kaNDadaDi\n\n6  ucci kuLirndadaDi sakhiyE uDambu nErAccu maccilum vIDumeLellAm munnaippOl manattukkottadaDi\niccai pirandadaDi edilum inbam viLaindadaDi accam ozhindadaDi sakhiyE azhagu vandadaDi\n\n7  eNNum pozhudilellAm avan kai iTTaviDattinilE taNNenrirundAraDi pudidOr shAnti pirandadaDi\neNNIyeNNIp-pArttEn avan tAn yArena cintai sheidEn kaNNan tiruvuruvam anganE kaNNin mum ninradaDi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/29/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0074.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/29/2007',
    title: 'unaiyE maiyyal',
    raga: ['kharaharapriyA'],
    lyrics:
      'pallavi  unaiyE mayal koNDEn vaLLI uvamayilariyAi uyirinuminiyAi\ncaraNam  enai AlvAi vaLLI vaLLI iLa mayilE en hrdaya malar vAzhvE\nkaniyE shuvaiyuru tEnE kalviyilE amudanaiyAi (kalviyilE)\ntaniyE jnAna vizhiyAi nilavinil ninai maruvi vaLLI vaLLI nIyAgiDavE vandEn',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/29/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0075.shtml',
    tala: 'roopakam',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '10/29/2007',
    title: 'uNmai arinthavar',
    raga: ['kalyANa vasantam', 'kAmbhOji'],
    lyrics:
      '1 uNmai arindavar unnaik-kaLippArO mAyaiyE manat-tiNmai uLLOrai nI sheivadum onruNDO mAyaiyE\n2  ettanai kOTi paDai koNDu vandAlum mAyaiyE nI cittat-teLivenum tIyin mun nirppAyO mAyaiyE\n3  ennaik-keduppadark-keNNamuTrAi keTTa mAyaiyE nAn unnaik-keDuppadu urudiyenrE uNar mAyaiyE\n4  shAgattuNiyil samuddiram emmaTTum mAyaiyE inda dEham poi enru Nar dhIrarai en sheivAi mAyaiyE\n5  irumai azhindapin engiruppAi arppa mAyaiyE teLindorumai kaNDAr munnadu ODAdu nirppAyO mAyaiyE\n6  nI tarum inbattai nErenru koLvEnO mAyaiyE singam tAi tarak-koLLumO nallara kATSiyE mAyaiyE\n7  enniccai koNDunai veTriviDa vallEnmAyaiyE ini unniccai kondu enakkonrum varAdu kAN mAAyaiyE\n8  yArkkum kuDiyallEn yAnenba tOrndanan mAyaiyE unran pOrkkanjuvEnO poDiyAkkuvEn unnai mAyaiyE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 10/29/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0076.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/07/2007',
    title: 'vaiyya muzhuthum',
    raga: ['jyOtiswarUpiNi'],
    lyrics:
      '1 vaiyya muzhudum paDaittATTuginra mahAshakti tan aruL vAzhttuginrOm\n sheyyum vinaigaL anaittilumE veTri shErndiDa nallaruL sheigavenrE\n\n2  bhUtangal-aindilirund-engum kaNNir-pulappaDum shaktiyaip-porukkinrOm\nvEdangaL shonna paDikku manidarai mEnmaiyura sheidal vENDumenrE\n\n3  vEgam kavarcci mudaliya palvinai mEviDum shaktiyai mEvuginrOm\nEka nilaiyil irukkum amrtattai yAngaLarindiDa vENDumenrE\n\n4  uyirenat-tOnri uNavu koNDE vaLarndOngiDum shaktiyai pOTruginrOm\nuyirinaik-kAkkum mazhaiyena engaLai bhAvittu nittamum vaLargavenrE\n\n5  cittatilE ninru shErvaduNarum shivashakti tanpugazh ceppuginrOm\nittarai mIdinil inbamgaL yAvum emaikkut-terindiDal vENDumenrE\n\n6  mArudalinri parAshakti tanpugazh vaiyamishai nittam pADuginrOm\nnUru vayadu pugazhuDan vAzhttuyar nOkkangaL peTriDa vENDumenrE\n\n7  Om shakti Om shakti Om shakti Om shakti Om shaktyenrurai sheidiDuvOm\nOm shaktiyenbavar uNmai kaNDAr kaDar oNmai koNDAr uyir vaNmai koNDAr',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 11/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0077.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/07/2007',
    title: 'vandE maataram enbOm',
    raga: ['nAdanAmakriyA'],
    lyrics:
      'pallavi  vandE mAtaram enbom engaL mAnilat-tAyai vaNangudum enbOm\ncaraNam 1 jAti madangaLaip-pArOm uyar janmam id-deshattil eidina rAyin\nvEdiyarAyinum onrE anri vEru kulattinarAyinum onre\n\n   caraNam 2  Inap-paraiyargaLEnum avar emmuDan vAzht-tingiruppavar anrO\nshInattarAi viDuvArO pira dEshattar pOrppala tIngizhaippArO\n\n   caraNam 3  Ayiram uNDikku jAti enil anniyar vandu pughal enna nIti Or\n tAyin vayiTril pirandOr tammun shaNDai sheidAlum sahOdarar anrO\n\n   caraNam 4  onru paTTAl uNDu vAzhvE nammil oTrumai nIngil anaivarkkum tAzhvE\nnanridu tErttiDal vENDum inda jnAnam vandArppin namakkedu vENDum\n\n   caraNam 5  eppadam vAittiDumEnum nammil yAvarkkum anda nilai poduvAgum\nmuppadu kOTiyum vAzhvOm vIzhil muppadu kOTi muzhumaiyum vIzhvOm\n\n    caraNam 6  pullaDimait-tozhil pENip-paNDu pOyina nATKaLuk-kini manam nANit-\ntollai igazhcigaL tIra indat-toNDu nilaimaiyai tUvenru taLLi',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 11/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0078.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/07/2007',
    title: 'vandE maataram jaya jaya',
    raga: ['hindustAni behAg'],
    lyrics:
      'pallavi   vandE mAtaram jaya jaya vandE mAtaram\ncaraNam 1 jaya jaya bhArata jaya jaya bhArata jaya jaya bhAtara jaya jaya jaya jaya\n   caraNam 2  Ariya bhUmiyil nAriyarum nara sUriyarum shollum vIriya vAcakam\n   caraNam 3  nondE pOyinum vendEmAyinum nandE sattar uvandE sholvadu\n   caraNam 4  onrAi ninrini venrAyinum uyir shenrAyinum vali kunrAdOduvam',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 11/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0079.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/07/2007',
    title: 'vaanulagu neer',
    raga: ['amritavarshini'],
    lyrics:
      'pallavi  vAnulagu nIr tarumEl maNmIdu marangaL vaghai vaghaiyAi nerkkaL purkkaL malindirukkumanrO\nanupallavi  mAnuDar uzhAviDinum vittu naDAviDinum varambu kaTTAviDinum anru nIr pAccAviDinum\ncaraNam  yAn edarkkum anjugilEn mAnuDarE nIvIr en madattai kaikkoLmin pADupaDal vENDA\nUnuDalai varuttAdIr uNavu iyarkkai koDukkum ungaLukku tozhilingE anbu sheidal kaNDIr',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 11/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0080.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '11/07/2007',
    title: 'varuvaai varuvaai',
    raga: ['tODi'],
    lyrics:
      'pallavi  varuvAi varuvAi varuvAi kaNNA varuvAi varuvAi varuvAi kaNNA\ncaraNam 1 uruvAi arivil vaLarvAi kaNNA uyirin amudAi pozhivAi kaNNA\nkaruvAi ennuL vaLarvAi kaNNA kamalat-tiruvODiNaivAi kaNNA\n\n   caraNam 2  iNaivAi enadAviyilE kaNNA idayattinilE amarvAi kaNNA\nkaNaiyA asurar talaigaL shidarak-kaNaiyUzhiyilE paDaiyODezhuvAi\n\n   caraNam 3  ezhuvAi kaDal mIdinilE ezhuvAi iravik-kiNaiyAi uLamIdinilE\ntozhuvEn shivanAm ninaiyE kaNNA tuNaiyE amarar tozhum vAnavanE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 11/07/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0081.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'veLLait-taamarai',
    raga: ['Anandabhairavi'],
    lyrics:
      '1 veLLait-tAmarai pUvil iruppAL vINai sheyyum oliyil iruppAL\nkoLLai inbam kulavu kavitai kUru pAvanar uLLattiliruppAL\nuLLadAm poruL tEDi uNarndE Odum vEdattiNuNNin-roLirvAL\nkaLLam aTra munivargaL kUrum karuNai vAcakatut-poruLAvAL\n\n2  mAdar tIngurarp-pATTiliruppAL makkL pEshum mazhalaiyiluLLAL\ngItam pADUm kuyilin kuralaik-kiLiyinAvai iruppiDam koNDAL\nkOdaghanra tozhiluDait-tAkkik-kulavu cittiram gOpuram kOyil\nIdanaittin ezhiviDai yuTrAL inbamE vaDivAgiDap-peTrAL\n\n3  vanjamaTra tozhil purinduNDu vAzhu mAndar kula deivamAvAL\nvenjamark-kuyirAgiya kollar viddaiyOrndiDu shirppiyar taccar\nminja narpporuL vANikam sheivOr vIra mannarpin vEdiyar yArum\ntanjam enru vaNangiDum deivam daraNi mIdarivAgiya deivam\n\n4  deivam yAvum uNarndiDum deivam tImai kATTi vilangiDum deivam\nuyvamenra karuttuDaiyOrgaL uyirinuk-kuyirAgaiya deivam\nsheyyamenroru sheigai eDuppOr shemmai nADi p-paNindiDum deivam\nkai varutti uzhaippavar deivam kavinjyar deivam kaDavuLar deivam\n\n5  shen tamizh maNi nATTiDaiyuLLIr shErndittEvai vaNanguam vArIr\nvandanam ivaTkE sheivadenrAl vAzhiyahtingeLidanru kaNDIr\nmantirattai muNumuNuttETTai varishaiyAga aDukkiyadan mEl\ncandanattai malarai iDuvOr shattiram-miyavaL pujanaiyanrAm\n\n6  vIDu tOrum kalaiyin viLakkam vIDu tOrum iraNDoru paLLi\nnADu muTrilum uLLanayUrgaL nagargaLengum pala pala paLLI\ntEDu kalvi ilAdadOr Urait-tIyinukk-iraiyAga maDuttal\nkEDu tIrkkum amudamen annai kENmai koLLa vazhivai kaNDIr\n\n7  Unar dEsham yavanartam dEsham udaya nyAyiTroLi peru nADu\nshENaghanradOr shiTraDi shInam selvap-pArasIka pazham dEsham\ntI\\Onalatta turukka mishiram shUzh kaDark-kappurattilinnum\nkANum parp-pala nATTIDaiyellAm kalvi dEvinoLi mighundOnga\n\n8  jnAnam enbadOr shollin poruLAm nalla bhArata nATTiDai vandIr\nUnaminru peridizhaiginrIr Ongu kalviyuzhaippai marandIr\nMAnamaTru viLangugaLoppa maNNil vAzhvadai vAzhvenalAmO\nPOnadarkku varundanal vENDa punmai tIrpa-muyalum yArIr\n\n9  innarum kaLi shOlaigaL sheidal iniya nIrttaNgaLai kaLiyaTral\nanna cattiram Ayiram vaittal Alayam padinAyiram nATTal\npinnaruLLa dharmangaL yAvum peyar viLangi oLira niruttal\nannayAvilum puNNiyam kOTi AngOr Ezhaik-kezhuttarivittal\n\n10  nidhi mighuttavar pOrkkuvai tArIr niti kuraindavar kAshugaL tArIr\naduvumaTravar vAi shollaruLIr AnmaiyAna kuzhaippinai nalgIr\nmadhurat-tEmozhi mAdargaLellAm vANi pUjaikkuruyana pEshIr\neduvum nalgi ingevvaghaiyAnum ipperum tozhil nAttuvam vArIr',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0082.shtml',
    tala: 'Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'vendumadi eppOdum',
    raga: ['nATTai', 'gambhIranATTai'],
    lyrics:
      'pallavi  vENDumaDi eppOdum viDudalai ammA\ncaraNam 1 tUNDuminba vADai vIshu tuyya tEnkaDal shuzhanra tIvilangu jyOti vAnavar\nINDu namadu tOzharAgi emmODamudamuNDu kulava\nnINDa magizhcci mUNDu viLaiya ninaittiDumnibam anaittum udava\n\n   caraNam 2  viruttirAdi tAn avarkku melivdinriyE viNNU maNNum vandu paNiya mEnmai tunriyE\nporuttamuradal vEdamOrndu poimmai tIra meimmai nEra\nvaruttamzhiya varumai ozhiya vaiya muzhudum vamai pozhiya\n\n   caraNam 3  paNNil iniya pADalODu pAyum oLiyellAm pAril emmai purimai koNDu paTri nirkkavE\nnaNNIyamarar veTri kUra namadu peNgaL amarar koLLa\nvaNNaminiya dEva maghaLIr maruva nAmum uvaghai tuLLa',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0083.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'vetri ettu dikkum',
    raga: ['mOhanam'],
    lyrics:
      'pallavi  veTri eTTu dikkum eTTa koTTu marashE vEdam enrum vAzhgavenru koTTu murashE\nanupallavi  neTri poTTai kaNnanOdE nartanam sheidAnL nitta shakti vAzhgavenru koTTu murashE\ncaraNam 1 uRukku nalladu sholvEn enakkuNmai terindadu sholvEn\nshIrukkellAm mudalAgum oru deivam tuNai sheyya vENdum\n   caraNam 2  vEdam arindavan pArppAn pala viddai terindavan pArppAn\nnIti nilai tavarAmal daNDa nEmangaL sheibavan nayakkan\n   caraNam 3  paNDangal virppavan ceTTi pirar paTTini tIrppavan ceTTi\ntoNdar enrOr vaghuppillai tozhilil shOmbalaippOl izhivillai\n   caraNam 4  nAlu vaghuppum ingonrE inda nAnginil onru kuraindAl\nvElai tavari shidaittE shettu vIzhndiDum mAniDa jAti\n   caraNam 5  onraik-kuDumbam tanilE poruL Onga vaLarppavan tandai\nmaTraik-karmangaL sheidE manai vAzhttiDa sheibavaL annai\n   caraNam 6  EvalgaL shibavar makkaL ivar yAvarum Or kulam anrO\nmEni alaivarum onrAi nalla vIDu naDattudal kaNDOm\n   caraNam 7  jAtip-pirivugaL sholli adil tAzhvenrum mElenrum koLvAr\nnItip-pirivugaL sheivAr angu nittamum shaNDaigaL sheivAr\n   caraNam 8  jAtik-koDumaigaL vENDAm anbu tannil shezhittiDum vaiyam\nAdaravuTringu vAzhvOm tozhil Ayiram mANbura sheivOm\n   caraNam 9  peNNukku jnAnattai vaittAn bhuvi pENi vaLarttiDum Ishan\nmaNNukkullE shila mUDhar nalla mAdar arivaik-keDuttAr\n   caraNam 10  kaNNan iraNDinil onraik-kutti kATSi keDuttiDalAmO\npeNgal arivai vaLarttAl vaiyam pEdamai aTriDum kANIr\n   caraNam 11 deivam pala pala sholli paghait-tIyai vaLarppavar mUDhar\nuyvadanaittilum onrAi engum Or poruLAnadu deivam\n   caraNam 12  tIyinaik-kuMbiDum pArppAr nittam dikkai vaNangiDum turukkar\nkOyil shiluvaiyin munnE ninru kumbiDum Eshu matattAr\n   caraNam 13  yAvarum paNIndiDum deivam poruL yAvinum ninriDum deivam\npArukkuLLe deivam onru idil parppala shaNDaigaL vENDAm\n   caraNam 14  veLLai nirattoru pUnai engaL vITTil varuvadu kANDIr\npiLLaigal peTradap-pUnai avai pErukkoru niramAghum\n   caraNam 15  shAmbal niramoru kuTTi karum shAndu niramoru kuTTi\npAmbu niramoru kuTTi veLLaip-pAlin niramoru kuTTi\n   caraNam 16  enda niramirundAlum avai yAvum orEtaram anrO\ninda niram shiridenrum ihdu Etramenrum shollalAmO\n   caraNam 17  vaNNangaL vETrumaip-paTTAl adil mAnuDar vETRumai illai\neNNangaL shigaigaLellAm ingu yAvarkkum onrenal kANIr\n   caraNam 18  nigharenru koTTu murashE inda Ninilam vAzhbavarellAm\ntagharenru koTTu murashE poimai jAti vaghuppinai ellAm\n   caraNam 19  anbenru koTTu murashE adil Akkam uNDAmenru koTTu\ntunbangaL yAvumE pOghum verum shUdup-pirivugaL pOnAL\n   caraNam 20  anbenru koYYu murashE makkaL attanai pErum nigharAm\ninbangaL yAvum perugum ingu yAvarum onrenru koNDAl\n  caraNam 21 uDan pirandArgaLaippOla ivvulagil mandar ellArum\niDam periduNDu vaiyattil idil Edukku shaNDai sheivIr\n   caraNam 22  marattinai naTTavan taNNIr nangu vaLarttE OngiDa sheivAn\nshraddhai uDaiyadu deivam ingu shErndE uNavellai illai\n   caraNam 23  vayiTrukku shOTruNdu kaNDIr ingu vAzhum manidar ellORkkum\npayiTri uzhuduNDu vAzhvIr  pirar pangai tiruDudal vENDAm\n   caraNam 24  uDan pirandavrgaLaippOla ivvulagil manidarellOrum\ndiDham koNDavar melindOrai ingu tinru pizhaittiDalAmO\n   caraNam 25  valimaiyuDaiyadu deivam nammai vAzhttiDa sheivadu deivam\nmelivu kaNDAlum kuzhandai tanai vIzhtti midittiDalAmO\n   caraNam 26  tambi shaTrE melivAnAl aNNan tAn aDimai koLLalAmO\nshembukkum kOmbukkum anji makkaLshiTr-aDimaippaDalAmO\n   caraNam 27  anbenru koTTu murashE adil yAvarkkum viDudalai uNDu\npinbu manidargaLellAm kalvi peTrup-padam peTru vAzhvAr\n   caraNam 28  ariyai vaLarttiDa vENDum makkaLattanai pErukkum onrAi\nshiriyArai mEmpaDa sheidAl pinbu deivam ellOraiyum vAzhttum\n   caraNam 29  pArukkuLLE samattanmai toDar paTrum sahOdarattanmai\nyArukkum tImai sheyyAdu puli engum viDudalai sheyyum\n   caraNam 30vayiTrukku shOriDa vENDum ingu vAzhum manidarukkellAm\npayiTrip-pala kalvitandu indap-pArai uyarttiDa vENDum\n   caraNam 31 onrenru koTTu murashE anbil Ongenru koTTU murashE\nnanrenru koTTu murashE inda nAnil mAndarukkellAm',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0084.shtml',
    tala: 'caapu',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'viddaikkiraivaa',
    raga: ['gowLa'],
    lyrics:
      'pallavi  viddaikkiraivA gaNanAthA mEnmait-tozhilirp-paNi enaiyE\nanupallavi  shakti tozhilE anaittumEnil shArnda namakku sancalamEn\ncaraNam  bhaktiyuDaiyAr kAriyattirp=padanAr mighunda porumaiyuDan\nvitti muLaikkum tanmai pOl mella sheidu payanaDaivAr',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0085.shtml',
    tala: '',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'viDuthalai viDuthalai',
    raga: ['bilahari'],
    lyrics:
      'pallavi  viDudalai viDudalai viDudalai\n1 paraiyarukku ingu tIyar pulaiyarukkum viDudalai paravarODu kuravarukku maravarukkum viDudalai\ntiramai koNDa tImaiyaTra tozhil purindu yAvarum tErnda kalvi jnAnameidi vAzhvaminda nATTilE\n\n2  Ezhai enrum aDimai enrum evanumillai jAtiyil izhivu koNDa manidarenbad-indiyAvil illaiyE\nvAzhi kalvi shelvameidi manamagizhndu kUDiyE manidar yArumorunigar samAnamAga vAzhgavE\n\n3  mAdar tammai izhivu sheyyu-maDamaiyaik-koLuttuvOm vaiya vAzhvu tannilenda vaghaiyilum namakkuLE\ntAtarenra nilaimai mAri ANgaLODu peNgaLum sari nigar samAnamAga vAzhminda nATTilE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0086.shtml',
    tala: 'tishra Eka',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'villinaiyottha paruvam',
    raga: ['punnAgavarALi'],
    lyrics:
      '1 villinaiyotta paruvam vaLaittanai vElavA angOr verppunorungip-poDiyAnadu vElavA\nshollinait-tEnirk-kuzhaitturaippAn shiru vaLLiyaik-kaNDu shokki maramena ninranai tenmalaik-kATTilE\nkallinaiyotta valiya manam koNDa pAdakan singan kaNNiraNDAyiram kAkkai k-kiraiyiTTa vElavA\npallinaik-kATTi veN mukhattaip-pazhittiDum vaLLiyai oru pArppanak-kOlam tarittuk-karam toTTa vElavA\n\n\n2  veLLalaik-kaigaLaik-koTTi muzhangum kaDalinai uDal vembi marugik-karugip-pughaiyaveruTTinAi\nkoLLai koNDE amarAvati vAzhvu kulaittavan bhAnu kOpan talai pattuk-kOTit-tuNukkurak-kOpittAi\ntuLLik-kulAvit-tiriyum shiru vana mAnaippOl tinait-tOTTattilEyoru peNNai maNakkoNDa vElavA\n\n3  Aru shuDar mukham kaNDu vizhik-kinbamAgudE kaiyil anjalenum kuri kaNDu magizhcciyuNDAgudE\nnIru paDakkoDum pAvam piNI pashi yAvaiyum ingu nIkkiyaDiyArai nittamum kAttiDum vElavA\nkUru paDappala kOTiyavuNarin kUTTattaik-kaNDu kokkarit-taNDam kulunga naghaittiDum shEvalAi\nmAru paDappala vEru vaDivODu tOnruvAL engaL vairavi peTra perukkanalE vaDivElA',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0087.shtml',
    tala: 'aadi',
    composer: 'Subramanya Bhaaratiyaar',
    language: 'Tamil',
    updated: '12/03/2007',
    title: 'yaadumaagi ninraai',
    raga: ['nIlAmbari'],
    lyrics:
      '1 yAdumAgi ninrAi kALi engum nI niraindAi tIdu nanmaiyellAm ninran sheigaiyanri illai\n Adi shakti tAyE enmIdaruL purindu kAppAi enda nALum ninmEl tAyE ishaigaL pADi vAzhvEn\npOdumingu mAndar vAzhum poimmai vAzhkkaiyellAm Adi shakti tAyE en mIdaruL purindu kAppAi\n\n2  enda nALu ninmEl tAyE ishaigaL pADi vAzhvEn kandanaip-payandAi tAyE karuNai veLLamAnAi\nmanda marutattil vAnil malaiyinUcci mIdil cintai engu shellum angun shemmai tOnrumanarE\n\n3  karma yOgamonrE ulagil kAkkumenrum vEdam dharma nIti shiridum ingE tavaralenbadinri\n marmamAna poruLAm ninran malADik-kaN nenjam shemmaiyuTru nALum shErndadEga kUDa vEnDum\n\n4  enranuLLa veLiyil jnAnat-tiraviyera vENDum kunramotta tOLum mEruk-kOlamotta vaDivam\nnanrai nADu manamumnIyen nALumIdal vENDum onrai viTTu maTrOr tuyaril uzhalu nenjam vENDA\n\n5  vAnaghattin oLiyak-kaNDE manamagizhcci pongi yAn edarkkum anjEn Aghi \nenda nALum vAzhvEn jnAnamottadammA uvamainAnuraikkoNADAm vAnagattiazhagai oLiyin vAzhttumariyAdO\n\n6  nyAyirenra kOLam tarumOr nalla pEroLikkE tEya mIdOr uvamai evarE tEDiyOdavallAr\nvAyinikkumammA azhagAmmatiyininba oLiyai nEyamOdurattAi AngEnenjiLakkameidum\n\n7  kALi mIdu nenjam enrumkalandu nirkka vENDumvElaiyotta viralum pAril vEndarEttu pugazhum\nyALiyotta valiyum enrum inba nirkku manamumvAzhi Idal vENDum annAi vAzhga ninran aruLE',
    meaning:
      'Other information:\n\nLyrics contributed by Lakshman Ragde.\n\n\n\n\n\n\n\nfirst | \n\n\nprevious | \n\nnext\n\n\n\nContact us\n\n\nupdated on 12/03/2007',
    notation: '',
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c0100.shtml',
    tala: 'Adi',
    composer: 'Sangeetha Narayanan',
    language: 'Sanskrit',
    updated: '02/15/2023',
    title: 'jaya vinAyakA vidhyA pradAyaka - Click to listen!',
    raga: ['sumanEsharanjani'],
    lyrics:
      'pallavi\n\n\njaya vinAyakA vidhyA pradAyakA (nAyaka)\njaya shivakumAra chatura dheera samarashUra sodarA (jaya vinAyaka)\n\n\n\n\n\nanupallavi\n\n\n\nprathama dEvathA pArvathI suthA\naja murAri vandita vijaya kArakA tAraka (jaya vinAyakA)\n\n\n\n\n\n\n\ncaraNam\n\n\nvikaTa kAvya rachitA vara makuta bhUshaNA\nsumanEsharanjanI nAtha mahEsha bAlakA\nsakalalOka mahitA sangeetha moditA\narka durva mOdaka priya gaNeshwarA bhAsvara (jaya vinAyakA)',
    meaning:
      'Victory to my Lord Vinayaka, who bestows knowledge, who is the son of Lord Shiva, who is intelligent and brave, who is the brother of the battle warrior  (Muruga).\n\nHe is the GOD worshipped first, the son of Goddess Parvathi, the one worshipped by Lord Brahma and Lord Vishnu, who is the cause of victory and who ferries us across the ocean of worldly life.\n\nHe is the poet who composes humorous poems and adorns a beautiful crown. He is the son of Lord Mahesha (Shiva), who is the husband of Goddess Sumanesharanjani (Parvathi). He is the one who is revered by all the worlds, who delights in music. He is Ganeshwara, who is pleased by Arka (Erukkampoo Flower), Durva (Durva Grass, Arugampul) and Modaka (A traditional sweet), and shines as bright as the sun.',
    notation: '',
    otherInfo: 'Lyrics, meaning, and audio contributed by Sangeetha Narayanan.',
  },
  {
    id: 'c0105.shtml',
  },
  {
    id: 'c0106.shtml',
  },
  {
    id: 'c0107.shtml',
  },
  {
    id: 'c0108.shtml',
  },
  {
    id: 'c0109.shtml',
  },
  {
    id: 'c0110.shtml',
  },
  {
    id: 'c0111.shtml',
  },
  {
    id: 'c0112.shtml',
  },
  {
    id: 'c0113.shtml',
  },
  {
    id: 'c0114.shtml',
  },
  {
    id: 'c0115.shtml',
  },
  {
    id: 'c0116.shtml',
  },
  {
    id: 'c0117.shtml',
  },
  {
    id: 'c0118.shtml',
  },
  {
    id: 'c0119.shtml',
  },
  {
    id: 'c0120.shtml',
  },
  {
    id: 'c0121.shtml',
  },
  {
    id: 'c0122.shtml',
  },
  {
    id: 'c0123.shtml',
  },
  {
    id: 'c0124.shtml',
  },
  {
    id: 'c0125.shtml',
  },
  {
    id: 'c0126.shtml',
  },
  {
    id: 'c0127.shtml',
  },
  {
    id: 'c0128.shtml',
  },
  {
    id: 'c0129.shtml',
  },
  {
    id: 'c0130.shtml',
  },
  {
    id: 'c1000.shtml',
    tala: 'aadi',
    composer: 'OotukkaaDu VenkaTasubbaiyyar',
    language: 'Tamil',
    updated: '03/22/2009',
    title: 'alai paayudE - Click to listen (Sowmya)!',
    raga: ['kaanaDaa'],
    lyrics:
      'pallavi\n\n\n\n\n\nalai pAyudE kaNNA en manam migha alai pAyudE\nun Ananda mOhana vEnugAnamadil\n\n\n\n\n\nanupallavi\n\n\n\n\nnilai peyarAdu shilai pOlavE ninra \n\n\nnEramAvadariyAmalE migha vinOdamAna\nmuralIdharA en manam\n\n\n(alai)\n\n\n\n\n\ncaraNam\n\n\n\nteLinda nilavu paTTappaghal pOl eriyudE un dikkai nOkki enniru puruvam\nneriyudE\n\nkaninda un vENugAnam kATril varugudE kaNgaL shorugi oru vidham varugudE \n\n\n\nmadhyama kaalam\n\n\n\n\n\n\n\nkaditta manattil urutti padattai enakku aLittu magizhtta vA oru tanitta vanattil\naNaittu enakku uNarcci\n\nkoDuTTu mugizhtta vA kalai kaDal alaiyinil kadiravan oLiyena iNaiyiru\nkazhal-enakkaLittavA\n\nkadari manamuruga nAn azhaikkavO idara mAdaruDan nI kaLikkavO idu taghumO idu\nmuraiyO\n\nidu dharumam tAnO kuzhal UdiDum pozhudu AdiDum kuzhaigaL pOlavE manadu vEdanai\nmighavODu\n\n(alai)',
    meaning:
      'pallavi  \n                                     My mind is all aflutter, Oh Krishna, listening to the joyous, enchanting music of your flute, My mind is all\n                                     aflutter!  \n                                     anupallavi  \n                                     Transfixed, I stood there like a statue, oblivious of even the passage of time, hey, mysterious flautist!  \n                                     caraNam  \n                                     In this clear moonlight (that makes a day of the night), I strain my eyebrows hard and look in your direction,\n                                     the mellow tunes of your flute come floating in the breeze... my eyes feel drowsy and a new feeling sweeps my\n                                     being  \n\n                                     Come! Mould my tender heart, make it full and fill me with joy! Come! take me to a lonely grove and fill me\n                                     with the emotions of ecstatic union!  \n\n                                     You are the one who danced and made merry on the sun-bathed waves of the ocean!  \n                                     Am I to go on pleading for you with melting heart, While you are enjoying yourself with other women? Is it\n                                     right? Is it proper? Is it what dharma is? My heart dances even like your eardrops do when you blissfully play\n                                     the flute! (My sad heart is all aflutter)',
    notation:
      'Notation is available here in Tamil on page 1 and page 2. Notation in English is here.',
    otherInfo:
      'Lyrics and Tamil notation contributed by Lakshman Ragde. English notation contributed by M Sekhar. Meaning from http',
  },
  {
    id: 'c1001.shtml',
    tala: 'roopakam',
    composer: 'Swaati TirunaaL',
    language: 'Sanskrit',
    updated: '05/23/2012',
    title: 'bhaavaiyaami - Click to listen (Semmangudi Srinivasa Iyer)!',
    raga: [
      'saavEri',
      'saavEri',
      'naaTTai kurinji',
      'dhanyaasi',
      'mOhanam',
      'mukhaari',
      'poorvi kalyaaNi',
      'madyamaavati',
    ],
    lyrics:
      'pallavi\n\n\n\nsaavEri\n\n\n\n\n\n\n\nbhaavayaami raghuraamam  | bhavyasuguNaaraamam ||\n\n\n\n\n\n\n\nanupallavi\n\n\n\n\n\n\n\nbhaavukavitaraNaparaa- | paangaleelaalasitam ||\n\n\n\n\n\n\n\nsrgsr,mpdpd, | RSndndpmgrsd. |\n\n\n\nsrm,grmpd,pmpdS,ndndpmpd | \n\n\n\nGRSd,RSd,,Sd,,GRndmgrsd. | (bhaavai)\n\n\n\n\n\n\n\ncaraNam 1\n\n\n\nnaaTTai kurinji\n\n \n\n28 harikaambhOji janya\n\nAa: S R2 G3 M1 N2 D2 N2 P D2 N2 S\n\nAv: S N2 D2 M1 G3 M1 P G3 R2 S\n\n\n\n\n\n\n\ndinakaraanvayatilakam | divyagaadhi sudasavanaa ||\n\n\n\nvanaracitasubaahumukha- | vadamahalyaa paavanam ||\n\n\n\nanaghameeSaSaapapangam | janakasudaapraaNeSam ||\n\n\n\nghanakupithabhruguraama | garvaharamithasaakEtam ||\n\n\n\n\n\n\n\nmgs,n.d.n.s,rgm | ndm,grgmpgrs |\n\n\n\nn.d.n.srgmndnpdnSndnSRGMGsn |\n\n\n\n(GRSd...) \n\n\n\n(bhaavai)\n\n\n\n\n\n\n\ncaraNam 2\n\n\n\ndhanyaasi\n\n \n\n8 hanumatODi janya\n\nAa: S G2 M1 P N2 S\n\nAv: S N2 D1 P M1 G2 R1 S\n\n\n\n\n\n\n\nvihahabhishEkamata | vipinagatamaaryavaaca ||\n\n\n\nsahitaseetaa sowmeetrim | shaantatama sheelam ||\n\n\n\nguhanilayagatam citra- | kooTaagatabharata tatta ||\n\n\n\nmahitaratnamayapaadukam | madanasundaraangam ||\n\n\n\n\n\n\n\nn.sg,mpgmp,nS | RSRnSpdpg,rs |\n\n\n\nnsgmpg,mpnSp,nSGRSndpnS |\n\n\n\n(GRSd...) \n\n\n\n(bhaavai)\n\n\n\n\n\n\n\ncaraNam 3\n\n\n\nmOhanam\n\n \n\n28 harikaambhOji janya\n\nAa: S R2 G3 P D2 S\n\nAv: S D2 P G3 R2 S\n\n\n\n\n\n\n\nvitatadaNDa kaaraNyagata- | viraadadaLanam ||\n\n\n\nsucaritaghaTajadataanu bam- | idavaishNavaastram ||\n\n\n\npatagavarajaTaayunootam | panchavaTeevihitaavaasam ||\n\n\n\natighOraSoorppaNakhaavaSan- | aagatakaraadiharam ||\n\n\n\n\n\n\n\ng,,pgrgrsd.sr | g,,pdSdpgrsr |\n\n\n\ngpggrsrgrrsdsrgrgpgpdpdS |\n\n\n\n(GRSd...) \n\n\n\n(bhaavai)\n\n\n\n\n\n\n\ncaraNam 4\n\n\n\nmukhaari\n\n \n\n22 kharaharapriya janya\n\nAa: S R2 M1 P N2 D2 S\n\nAv: S N2 D1 P M1 G2 R2 S\n\n\n\n\n\n\n\nkanakamrugaroopadharakha-  | lamaaricaharamiha su- ||\n\n\n\njanavimata daSasyahruta- | janaka jaanvEshanam ||\n\n\n\nanagham pampateeirasangata- | anjanE nabhOmaNi ||\n\n\n\ndanujasakhyakaram vaali- | tanudaLanameeSam ||\n\n\n\n\n\n\n\np,,mgrs,n.d.sr | m,,grsrmpmnd |\n\n\n\nS,Sndpp,mgrsn.d.srmpndmpds |\n\n\n\n(GRSd...) \n\n\n\n(bhaavai)\n\n\n\n\n\n\n\ncaraNam 5\n\n\n\npoorvi kalyaaNi\n\n \n\n53 gamanashrama janya\n\nAa: S R1 G3 M2 P D2 P S\n\nAv: S N3 D2 P M2 G3 R1 S\n\n\n\n\n\n\n\n\n\nvaanarOttamasahitavaa- | yusunukaraarpita- ||\n\n\n\nbhaanusaSatabhaasvarabhavya- | ratnaanguleeyam ||\n\n\n\ntEna punaraaneetaa | nyoona cooDaamaNi darSanam ||\n\n\n\nshreenidhimudadhiteera- | SrutavibheeshaNa miLitam ||\n\n\n\n\n\n\n\ng,mgrsd.s,rgm | p,,dpSndpmgr |\n\n\n\ngmpm,pg,mr,gs,rg,mpdpS,n |\n\n\n\n(GRSd...) \n\n\n\n(bhaavai)\n\n\n\n\n\n\n\ncaraNam 6\n\n\n\nmadyamaavati\n\n \n\n22 kharaharapriya janya\n\nAa: S R2 M1 P N2 S\n\nAv: S N2 P M1 R2 S\n\n\n\n\n\n\n\nkalitavarasetubandham | khalaniseesumapiSidaaSana- ||\n\n\n\ndaLanamurudaSakaNTa- | vidaaraNamatidheeram ||\n\n\n\njvalana putajanakasudaa- | sahitamyaadasaakEtam ||\n\n\n\nvilasitapaTTaabhishEkam- | viSvapaalampadmanaabham ||\n\n\n\n\n\n\n\nr,mrmpn,pmpn | S,,nSnppmmrs |\n\n\n\n\n\n\n\nRagam1: rpmrsn.srmp\n\n\n\nRagam2: dpS,ndpmgmgr\n\n\n\nRagam3: s,n.d.srmg,rsr\n\n\n\nRagam4: g,dpgrsrgpdS\n\n\n\nRagam5: RSd,pdpg,rs\n\n\n\nRagam6: n.smgmndnpdnS\n\n\n\nRagam0: (GRSd...) \n\n\n\n(bhaavai)',
    meaning:
      'bhaavayaami raghuraamam | bhavyasuguNaaraamam ||\n"I mediatate upon Shri Raama, Scion of the Raghu clan | In whom reside all the glorious virtues"\nbhaavukavitaraNaparaa- paangaleelaalasitam ||\n"(Oh!)The one who transmigrates all over the ocean of emotions(Samsaara),Who displayed his shining , par excellence passtimes! "\ndinakaraanvayatilakam | divyagaadhi sudasavanaa ||\n"The Scion of the race of the Sun,institutor of Divine sacrifices! "\nvanaracitasubaahumukha- | vadamahalyaa paavanam ||\n"In the forest , he(who) engaged in the Killing of (the Demon) Subahu, (He who) purified (or emancipated)Ahalya (from her curse by Gowtama Muni , her husband)"\nanaghameeSaSaapapangam |janakasudaapraaNeSam ||\n"The sinless one (who) broke Shiva\'s Bow , (and therby became the) life breath of Janaka\'s Daughter(Sita)"\nghanakupithabhruguraama |garvaharamithasaakEtam ||\n"(He who) Defeated the Pride of BhriguRaama(ParashuRama), that ParashuRaama, who was densely filled with wrath , the King of Saketa "\nvihahabhishEkamata |vipinagatamaaryavaaca ||\n"(One, who)having given up the coronation ceremony, went towards the forest and (was)"\nsahitaseetaa sowmeetrim | shaantatama sheelam ||\n"Accompanied by Sita (along with) the son of Sumitra(LakshmaNa), composed and virtuous ! "\nguhanilayagatam citra- kooTaagatabharata tatta ||\n"The one who (later)goes to Guha\'s house, Thereon proceeding to the ChitraKoota mountain, and (whom) Bharata follows there"\n\nmahitaratnamayapaadukam | madanasundaraangam ||\n"(And then the episode of)The Divine ruby encrusted Sandals, He whose beauty enchants Cupid himself ! "\nvitatadaNDa kaaraNyagata- viraadadaLanam ||\n"He who went to the dense DandaKaaranya, He who killed the demon Viraada"\nsucaritaghaTajadataanu bam- idavaishNavaastram ||\n"The one with a flaless charecter, who bestowed benedictions to Agastya\'s Disciple(SharaBhanga),which (here referring to the blessing) is more than(like the) the VaishNavastram" (Author may be making a reference to the incident in the Mahabarata where Bhagadatta aims a VaishNavAstra at Arjuna. Krishna asks Arjuna to fold his hands in an Anjali. Seeing the Anjali , the weapon lodges itself in the chest of Krishna. Then Krishna tells Arjuna that he(Arjuna) was saved from the terrible VaishnavAstra only because fof the Anjali , thereby proving to the world that devotional submission to the Supreme protects one even from the utmost , that is , even from the wrath of the Supreme!)\npatagavarajaTaayunootam |panchavaTeevihitaavaasam ||\n"He who was saluted by the king of vultures , JaTayu , he who lead a  restrained life in the forest of PanchavaTi"\natighOraSoorppaNakhaavaSan- aagatakaraadiharam ||\n"He who caused horrifying (She-Demon) ShoorpaNaKha , to (run) towards her death !" (ShoorpanaKha runs to her brother RavaNa yelling about how LakshmaNa had mutilated her, thereby starting the entire war episode)\nkanakamrugaroopadharakha- lamaaricaharamiha su- ||\n"He who slays the wicked demon Maricha, that MarIcha, who had assumed the form of a golden deer ,  "\njanavimata daSasyahruta-  janaka jaanvEshanam ||\n"Hw wh searched for the daughter of Janaka(JAnaki,Sita),abducted by the ten faced Demon(RavaNa), that RavaNa, who  disregarded the (wise) counsel of the Good men "\nanagham pampateeirasangata- anjanEnabhOmaNi ||\n"The sinless one , who met Anjeneya, at the banks of the pampA (river/Lake), the (supreme one from the race of the )Sun God! "\ndanujasakhyakaram vaali-tanudaLanameeSam ||\n"He , the Lord , who slayed Vaali\'s body, that Vali, who was the befriender of demons "\nvaanarOttamasahitavaa- yusunukaraarpita- ||\n"He who ,along with the King of the Monkeys, unto the son of Vayu( Hanuman)  "\nbhaanusaSatabhaasvarabhavya- ratnaanguleeyam ||\n" gave the divine ruby-encrusted ring, as resplendant as a hundred suns !"\ntEna punaraaneetaa | nyoona cooDaamaNidarSanam ||\n"And who certainly saw the hair-ornament, that was brought back by him( Hanuman)"\nshreenidhimudadhiteera- SrutavibheeshaNa miLitam ||\n"The repository of all riches , who was met by the submissive viBheeshana , on the shores of the ocean"\nkalitavarasetubandham |khalaniseesumapiSidaaSana- ||\n"He who caused the creation of the divine bridge , and rocked the throne of the king of the demons(RavaNa)"\ndaLanamurudaSakaNTa-  vidaaraNamatidheeram ||\n"He who slays the (demon with) ten throats( RavaNa) easily , the magnificiently brave one "\njvalana putajanakasutaa-  sahitamyaadasaakEtam ||\n"He who , along with the daughter of Janaka , purified by the blazing fire , departed to (the city of) sAkEta"\nvilasitapaTTaabhishEkam-  viSvapaalampadmanaabham ||\n"The one who directed the coronation , the King of the world , the one with a lotus in his navel !"\n\nShri KrishNaarpaNamastu. contributed by Jayaram Suryanarayana',
    notation:
      "Notation available here at Shivkumar Kalyanaraman's Krithi Archive. Also, listen to the music class \nhere.",
    otherInfo:
      'This song was originally composed in saavEri. It was later modified by Semmangudi Srinivasa Iyer into a ragamalika with six ragas.',
  },
  {
    id: 'c1002.shtml',
    tala: 'dEshaadi',
    composer: 'Tyaagaraaja',
    language: 'Telugu',
    updated: '06/01/2012',
    title: 'brOva bhaaramaa - Click to listen (Shivkumar Kalyanaraman)!',
    raga: ['bahudaari'],
    lyrics:
      'pallavi\n\n\n\nbrOva bhAramA raghurAmA bhuvanamella nIvai nannokani\n\n\n\n\n\nanupallavi\n\n\n\nshrI vAsudEva anDakOTula gukSiNi yuncakOlEdA nannu\n\n(brOva)\n\n\n\ncaraNam\n\n\n\nkalashAmbudhilO dayatO namarulakai adigAka gOpi\n\n    kalakai koNDa letta lEdA karuNAkara tyAgarAjuni\n\n(brOva)\n\n\n\ngmg,gg,gmpmgmgsgmg,gg,nsnpmgs, |\n\n\n\ngmg,gg,snpmgsnsgmg,gg,sgsnpmgppm |\n\n\n\ng,gg,pmg,gg,npm,mm,snp,pp, |\n\n\n\ngsn,nn,mgs,ss,nnssns,sppnnpn,n |\n\n\n\nmmppmp,pggmmgm,mgsmmgsppmgnnpmssnp |\n\n\n\nggsnmmgsppmgmmgsggsnssnpnnpmpmgs |\n\n\n\nsnpmgssgmpdns,gmpdns,mpdns,pdns, |\n\n\n\ndns,ns,sm,,g,mgsnp,,g,,s,gsnpm,,p,m,mgsgm || (BrOva)\n\n\n\nCiTTa swaram\n\n\n\n\n\n\n\npdnS Sndn pddn pmgs | pmgm gssn. smgm p,,, ||\n\n\n\nmmgs sgmp dnpd nSGM | GS,S dnp,  pmgs ,sgm ||',
    meaning:
      'Oh Karunaakaraa (a name for Vishnu), is it a heavy burden for you to protect a single soul like me? You are the whole universe itself and as Krishna showed it all to be in your stomach. Have you not lovingly borne for the sake of the Devas the whole  weight of Mount Mandara when the ocean was churned, and have you not lifted Mount Govardhan for the sake of Gopis?',
    notation:
      "Notation available here at Shivkumar Kalyanaraman's Krithi Archive. Also, listen to the music class here.",
    otherInfo: 'Lyrics contributed by Lakshman Ragde. Swaras contributed by TV Gopalakrishnan.',
  },
  {
    id: 'c1003.shtml',
    tala: 'dEshaadi',
    composer: 'Tyaagaraaja',
    language: 'Telugu',
    updated: '06/19/2013',
    title:
      'banTu reeti kOlu - Click to listen (Aruna Venkatraman. Also T.M. Krishna, and M.S. Subbulakshmi)!',
    raga: ['hamsanaadam', 'hamsanaadam'],
    lyrics:
      'pallavi\n\n\n\n\n\n\n\nbanTu reeti kOlu viyavaiyya raama | (banTu)\n\n\n\n\n\n\n\nanupallavi\n\n\n\n\n\n\n\ntuNTa viNTi vaani modalaina madaa- |\n\n\n\ndula goTTi nela goola jEyu nija ||\n\n\n\n(banTu)\n\n\n\n\n\n\n\ncaraNam\n\n\n\n\n\n\n\nrOmaanca manu ghana kancukamu |\n\n\n\nraama bhaktuDanu mudra biLLayu ||\n\n\n\nraama naama manu vara khaDga mivi |\n\n\n\nraajillu naiyya tyaagaraajuni kE || \n\n\n\n(bunTu)',
    meaning:
      "In this song Sri Thyagaraja pleads with Rama to give him the post of a guard for Raama; symbolically meaning that he always wants to be in Sri rama's sannidhi (in his presence).\n\n\n\nHe says in the anupallavi, the guard's post should be such\n\n\n\nthat he is empowered to destroy all the demons which are arishadvargas (kama-love, krodha, lobha, moha, mada, matsarya) and since the guard is empowered to do so, he needs such a guard's post. \n\n\n\nIn the caraNam, he says he should be blessed with the\n\n\n\nemblem of Ramabhakti, given a sword called Raama Naama (the name of Raama) to perform his guard's job.",
    notation:
      "Available in English here. Also available on Shivkumar Kalyanaraman's site here. Listen to the music class here.",
    otherInfo:
      'This song popularized the raga hamsanaadam.\n\nSong performed for karnATik by Aruna Venkatraman.',
  },
  {
    id: 'c1004.shtml',
    tala: 'aadi',
    composer: 'Tyaagaraaja',
    language: 'Telugu',
    updated: '05/23/2012',
    title: 'duDuku gala nannE dora - Click to listen (Shivkumar Kalyanaraman)!',
    raga: ['gowLa'],
    lyrics:
      'pallavi \n\nduDuku gala nannE dora koDuku brOcurA entO\n\n\n\n\n\n\n\nanupallavi \n\nkaDu durviSayA krSTuDai-gaDiya gaDiyaku ninDAru\n\n\n\n\n\n\n\ncaraNam 1\n\n\nshrI vanitA hrtkumudAbjA vAngmAnasa gOcara\n\n\n\n\n\n\n\ncaraNam 2\n\n\n\n\nsakala bhUtamula andu nI vaiyuNDaga madilEka pOyina\n\n\n\n\n\n\n\ncaraNam 3\n\n\n\n\n\n\n\nciruta prAyamu nADe bhajanAmrta rasavihIna kutarkuDaina\n\n\n\n\n\n\n\ncaraNam 4\n\n\npara dhanamula koraku nOrula madini karaga-baliki kaDupu\nnimpa diriginaTTi\n\n\n\n\n\n\n\n\ncaraNam 5\n\n\ntanamadini bhuvini saukhyapu jIvanamE anucu sadA dinamulu\ngaDipE\n\n\n\n\n\n\n\n\ncaraNam 6\ntelayani naTaviTa kSUdrulu vanitalu sva vashamauta-\nkupadEshinci santasilli\nsvaralayambu lerungakanushIlAtmuDai su-bhaktulaku samanamanu\n\n\n\n\n\n\n\ncaraNam 7\ndruSTiki sArambagu lalanA sadanArbhaka sEnAmita dhanAdulanu\ndEvadi dEva\n     nera nammitini gAkanI padAbja bhajanambu maracina\n\n\n\n\n\n\n\n\ncaraNam 8\n\ncakkani mukha kamalambunu sadA nA midilO smaraNa lEkanE\ndurmadAndha-\n     janula kOri paritApamulacE dagili nogili durvisaya\ndurAsalanu rOyalEka\n     satata maparAdhinai capala cittuDanaina\n\n\n\n\n\n\n\n\ncaraNam 9\n\nmAnavatanu durlabha manucu nEnci paramAnanda mondaleka mada\nmatsara\n     kAma lObha mOhamulaku dAsuDai mOsabOti gAka modaTi\nkulajuDagucu bhuvini\n     shUdula panulu salpucunu uNTinigAka nArAdamulu kOri sArahIna\nmatamulanu sAdhimpa dArumAru\n\ncaraNam 10\n\nsatulakai konnALLAstikai sutulakai konnALLu dhana tatulakai\ntirigiti nayya tyAgarAjApta ituvaNTi',
    meaning:
      'Oh Rama! I have unabashedly committed many sins. Who, in this world, will rescue me? Every moment I was slave to evil doings. I did not understand your omnipresence in\nthis world. I did not take the path of devotion within the age of 12. I praised others to covet wealth and earn my livelihood, I was foolishly happy thinking that all that is\nworldly is happiness. I attracted the common folk and women by my speech, while doing so, I thought that I am equal o the greatest musicians and great men of letter . I was\nsteeped in pride. I thought that land, property, wealth, servants etc. are permanent. I forgot to worship and pray at god�s lotus feet, God�s face did not dwell in my mind. I\nsought egoistic men. I did not shun evil thoughts. I was tormented by them. I forgot to appreciate the great value of having got this rate opportunity of human birth. I was\nslave to carnal desire and other evil thoughts. I did things, which were not befitting my class, Who ever will rescue me?  (Shri Thyagaraja has sung this krithi putting himself in the place of a sinner fully owning his sins.)\n\npallavi: Who is there to save this great sinner?\nanupallavi: My sins are mounting every moment by my enticement to the evil deeds\ncaraNam 1: The moon to the lotus heart of Lakshmi. You are beyond comprehension of the mind and speech.\ncaraNam 2: I am a sinner who lost the sense to understand your omnipresence in all the living things.\ncaraNam 3: I am a sinner who slayed people without rhyme or reason and did not obtain the nectar of your worship in the young age.\ncaraNam 4: I am a sinner who went astray and repeatedly hurt people�s feelings for the sake of coveting their wealth.\ncaraNam 5: I am a sinner who whiled away the time thinking that everything happening in this materialistic world is happy living.\ncaraNam 6:  I preached to charm and obtain the attention of hypocrites who do not have wisdom, mean people who sought call girls and prostitutes. I was happy doing so feeling\nproud and egoistic that I am equal to any great follower of god without even having the capacity of understanding the swara or laya. \ncaraNam 7: I was carried away by outward appearances, women, land, property, children, servants and wealth thinking that these were permanent. Moreover, I have sinned by\nforgetting to worship your lotus feet.\ncaraNam 8: God�s face did not dwell in my mind. I sought egoistic men. I did not shun evil thoughts. I was tormented by them. \ncaraNam 9: I forgot to appreciate the great value of having got this rate opportunity of human birth. I was slave to carnal desire and other evil thoughts. Though I have been\nborn in the highest Brahmin class, I have been performing functions, which are very unbecoming of my class. I have continuously sinned.\ncaraNam 10: Oh my god! I have been a sinner who has gone astray in research of women, children and wealth at various stages of my life. \n\n\nMore meaning available here.',
    notation:
      "Notation available here at Shivkumar Kalyanaraman's Krithi Archive. Also, listen to the music class \nhere.",
    otherInfo:
      "One of the songs of Tyaagaraaja's Pancaratna (5 gems) kritis. Lyrics contributed by Lakshman Ragde.",
  },
  {
    id: 'c1005.shtml',
    tala: 'aadi',
    composer: 'Paapanaasam Shivan',
    language: 'Tamil',
    updated: '10/21/2020',
    title: 'durgaalakshmi saraswati',
    raga: ['aarabi', 'yamunaa kalyaaNi'],
    lyrics:
      'Click to view in: Tamil\n\n\npallavi\n\n\ndurgAlakSmi sarasvati tuNaiy aDi paNivAyE manamE\n\n\n\n\n\n\n\nanupallavi\n\n\nsvargApavarga inbam taruvAL shruti pughazh navarAtriyil uLLanbODu\n\n\n\n\ncaraNam\n\n\nmur pirappugaLil sheivinai ozhiyum mOhamudal aru paghaigaLum  azhiyum\nporppuyar mangaLa dIpam viLangum pugazhoDu magizhvum vAzhvil tulangum',
    meaning:
      'contributed by Suhasini Jayakumar\npallavi: oh mind, bow at the feet of these ladies (Goddesses Durga, Lakshmi, Saraswati, especially Durga, for whom NavarAtri is celebrated)\nanupallavi:  she gives those joys that are all inclusive, during the navarathri, famed for good music, with heart filled with love\ncaraNam:  the deeds of previous births will be cancelled, the 6 sins including\nMoham (illusion) will be destroyed\n ???????  auspicious lamps will be lit, and happiness will prevail, \nalong with fame, in life.',
    notation: '',
    otherInfo: 'Also sung in suddha dhanyaasi\nLyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c1006.shtml',
    tala: 'aadi',
    composer: 'Tyaagaraaja',
    language: 'Telugu',
    updated: '05/23/2012',
    title: 'endarO mahaanubhaavu - Click to listen (Shivkumar Kalyanaraman)!',
    raga: ['shree'],
    lyrics:
      'pallavi \n\nendarO mahAnubhAvu-landariki vandanamu\n\n\n\n\n\n\n\nanupallavi \n\ncanduru varNuni anda candamunu hrdayAra-\n    vindamuna jUci brahmAnandamanu bhavincu vAr-\n(endarO)\n\n\n\n\n\n\n\n\ncaraNam 1 \n\n\n\n\n\n\nsAma gAna lOla manasija lAvaNya dhanya mUrdhanyul\n(endarO)\n\n\n\n\n\n\n\ncaraNam 2\n\n\n\n\nmAnasa vana cara vara sancAramu salipi mUrti bAguga pogaDanE\nvAr-\n\n\n\n\n\n\n\n\ncaraNam 3\n\n\n\nsaraguna pAdamulaku svAntamanu sarOjamunu samarpaNamu sEyu\nvAr-\n\n\n\n\n\n\n\n\ncaraNam 4\n\npatita pAvanuDanE parAtparuni gurinci paramArthamagu nija\nmArgamutOnu\n     bADucunu sallApamutO svara layAdi rAgamula deliyu vAr-\n \n\n\n\n\n\n\n\ncaraNam 5\n\nhari guNa maNimaya saramulu galamuna shObhillu bhakta\nkOTulilalO telivitO\n     celimitO karuNa galgu jagamellanu sudhA drSTicE brOcu vAr-\n\n\n\n\n\n\n\n\ncaraNam 6\n\n\nhoyalu mIra naDalu galgu sarasuni sadA kanula jucucunu\npulaka\n     sharIrula I Ananda payOdhi nimagnula I mudambunanu yashamu\ngalavAr-\n\n\n\n\n\n\n\n\ncaraNam 7\n\nparama bhAgavata mauni vara shashi vibhAkara sanaka\nsanandana\n     digIsha sura kimpuruSa kanaka kashipu suta nArada tumburu\n     pavanasUnu bAlacandra dhara shuka sarOjabhava bhUsuravarulu\n     parama pAvanulu ghanulu shAshvatulu kamala bhava sukhamu\nsadAnubhavulu gAka\n\n\n\n\n\n\n\n\ncaraNam 8\n\n\nnI mEnu nAma vaibhavambulanu nI parAkrama dhairyamula shAnta\nmAnasamu nIvulanu\n     vacana satyamunu, raghuvara nIyeDa sadbhaktiyu janincakanu\ndurmatamulanu kalla\n     jEsinaTTi nImadi neringi santasambunanu guNa bhajanA-nanda\nkirtanamu jEyu vAr-\n\n\n\n\n\n\n\n\ncaraNam 9\n\n\n\nbhAgavata rAmAyaNa gItAdi shruti shAstra purAnamu\nmarmamulanu shivAdi sanmatamula\n     gUDhamulan muppadi mukkOTi surAntarangamula bhAvamula nerigi\nbhava rAga layAdi\n     saukhyamucE cirAyuvula galigi niravadhi sukhAtmulai\ntyAgarAptulaina vAr-\n\n\n\n\n\n\n\n\ncaraNam 10\n\n\nprEma muppiri gonu vELa nAmamu dalacEvAru rAmabhaktuDaina\ntyAgarAjanutuni nija dAsulaina vAr-',
    meaning:
      'pallavi: salutations to all those great men in this world ! \n\nanupallavi: those men will feel the moonlike beautiful form of God in their hearts and will be happy about it ! \ncaraNam 1: those who worship you who is fond of Samagana. \ncaraNam 2: They control their mind and worship you who is as beautiful as Manmada \ncaraNam 3: They submit their hearts at your feet \ncaraNam 4: Oh the protector of people they sing your praise with true devotion and they have good knowledge of swara, laya & raga. \ncaraNam 5: They wear garlands made of gems that represent the quality of Hari and with mercy they see the whole world with love & affection. \ncaraNam 6: They are so happy to see the beautiful gait of the God everyday and they are happy about it. \ncaraNam 7: Surya, Chandra, Sanaka Sanadhanas, Dikpalas, Devas, Kimpurushas, Prahalada, Narada, Tumburu, Anjaneya, Siva, Sukar, Brahma, Brahmanas enjoy the Brahmanandha\nSwaroopa of God always. Apart from them there are others and salutations to them also. \ncaraNam 8: They praise your form, name, valour, bravery, peaceful heart, true words. You destroy all bad thoughts that prevent people from praying you, they know that and they praise your qualities. \ncaraNam 9: Those who know the secret of Bagavatha, Ramayana, Gita, Sruti, Sasthra, Epic, various religious thoughts, the thoughts of the 33 crores of Devas, bhava, raga, tala and they\nhave a long life and enjoy all good things. \n\ncaraNam 10: Those beloved of Lord Tyagaraja, when bakthi increases they think your name, they are Rama bakthas, they are devotees of the Lord of Tyagaraja who worships you. \n\nMore meaning available here.',
    notation:
      "Notation available here at Shivkumar Kalyanaraman's Krithi Archive. Also, listen to the music class \nhere.",
    otherInfo: 'Lyrics contributed by Lakshman Ragde.',
  },
  {
    id: 'c1007.shtml',
    tala: 'aadi',
    composer: 'Paapanaasam Shivan',
    language: 'Tamil',
    updated: '03/22/2009',
    title: 'enna tavam seydanai yasOdaa - Click to listen (SP Ramh)!',
    raga: ['kaapi'],
    lyrics:
      'pallavi \n\n\n\n   \n\n\n\nenna tavam sheidanai yasOdA engum nirai parabhrammam ammAvenr-azhaikka\n\n\n\n(enna tavam) \n\n\nanupallavi\n\n\n\n\n\n\nIrEzu bhuvanangaL paDaittavanaik-kaiyil Endi shIrATTi pAlUTi tAlATTa nI \n\n\n\n(enna tavam)\n\n\n\n    \n\n\n\ncaraNam 1\n\n\n\n    \n\n\nbhramanum indranum manadil porAmai koLLa\n\nuralil kaTTi vAi pottik-kenjavaittAi tAyE\n\n\n\n(enna tavam)\n\n\n\n\n\ncaraNam 2 \n\n\n\n    \n\n\nsanakAdiyar tava yOgam sheidu varundi\n\nsAdhittadai punita mAdE eLidil pera \n\n\n\n(enna tavam)',
    meaning:
      'pallavi: Yashoda, what tapas (prayer, sacrifice) did you make, that the Almighty himself calls you dearly, "Mother" ?\n\nanupallavi: To take Krishna, the One who created the 14 worlds, to lift him into your arms, to rock him to sleep, to feed him milk, what great tapas did you do, Yashoda?\n\ncaraNam 1: O mother what tapas did you do, that to the great envy of Brahma and Indra, you could tie Krishna himself to the grinding stone and bound his mouth and make him beg you for mercy!\n\ncaraNam 2: What great sages like Sanakaa achieved through great tapas and yoga, what they reached by prodigious effort, you achieved so easily - what tapas did YOU do to have this great fortune?\nFull meaning and explanation by MG Vasudevan is here.',
    notation: 'Click here for the full notation (from Gayaka). Tamil notation available here.',
    otherInfo: 'Lyrics and Tamil notation contributed by Lakshman Ragde.',
  },
] as Song[];

export interface Tala {
  tala: string;
  songs: Song[];
}
export const allTalas = allData
  .reduce((acc, data) => {
    const index = acc.findIndex(a => a.tala === data.tala);
    if (index === -1) {
      acc.push({ tala: data.tala || '', songs: [data] });
    } else {
      acc[index].songs.push(data);
    }
    return acc;
  }, [] as Tala[])
  .sort((a, b) => (a.tala > b.tala ? 1 : -1));

export default allData;
