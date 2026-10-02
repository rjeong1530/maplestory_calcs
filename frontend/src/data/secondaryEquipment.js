// Exact job restrictions for the bundled GMS secondary catalog. Its `class`
// field contains broad reqJob families, which cannot enforce these rules.
// Job/secondary and shared Cygnus jewel references:
// https://www.maplesea.com/announcements/view/v251_AstraWeapon/
// GMS names: https://maplestorywiki.net/w/Astra_Honor_Shield
// https://maplestorywiki.net/w/Princess_No%27s_Leaf
// Keep explicit IDs: shields and spellbooks can share a type but differ by job.
export const SECONDARY_JOBS = {
  1092087: ["Hero","Paladin","Dawn Warrior"], // Deimos Warrior Shield
  1092088: ["Shadower"], // Deimos Shadow Shield
  1092089: ["Arch Mage (Fire/Poison)","Arch Mage (Ice/Lightning)","Bishop","Blaze Wizard","Evan","Battle Mage","Lynn"], // Deimos Sage Shield
  1092113: ["Hero","Paladin","Dawn Warrior"], // Terminus Defender
  1092123: ["Hero","Paladin"], // Astra Sacred Aegis
  1092126: ["Arch Mage (Fire/Poison)","Arch Mage (Ice/Lightning)","Bishop"], // Astra Arcane Shield
  1092129: ["Shadower"], // Astra Bane Shield
  1092132: ["Dawn Warrior"], // Astra Topaz Aegis
  1092135: ["Blaze Wizard"], // Astra Ruby Shield
  1092138: ["Evan"], // Astra Honor Shield
  1092141: ["Battle Mage"], // Astra Umbral Shield
  1092144: ["Lynn"], // Astra Leaf Shield
  1098003: ["Mihile"], // Soul Shield of Justice
  1098005: ["Mihile"], // Onyx Maple Soul Shield
  1098006: ["Mihile"], // Princess No's Soul Shield
  1098007: ["Mihile"], // Frozen Soul Shield
  1098008: ["Mihile"], // Maple Treasure Soul Shield
  1098009: ["Mihile"], // Evolving Soul Shield of Justice
  1098012: ["Mihile"], // Astra Soul Shield
  1099004: ["Demon Slayer","Demon Avenger"], // Force Shield of Extremes
  1099010: ["Demon Slayer","Demon Avenger"], // Onyx Maple Force Shield
  1099011: ["Demon Slayer","Demon Avenger"], // Princess No's Accursed Shield
  1099013: ["Demon Slayer","Demon Avenger"], // Frozen Force Shield
  1099014: ["Demon Slayer","Demon Avenger"], // Maple Treasure Force Shield
  1099015: ["Demon Slayer","Demon Avenger"], // Ruin Force Shield
  1099016: ["Demon Slayer","Demon Avenger"], // Evolving Force Shield of Extremes
  1099023: ["Demon Slayer","Demon Avenger"], // Astra Force Shield
  1342082: ["Dual Blade"], // Fafnir Rapid Edge
  1342090: ["Dual Blade"], // Sweetwater Katara
  1342101: ["Dual Blade"], // AbsoLab Katara
  1342104: ["Dual Blade"], // Arcane Umbra Katara
  1342121: ["Dual Blade"], // Astra Katara
  1352003: ["Mercedes"], // Infinite Magic Arrows
  1352008: ["Mercedes"], // Onyx Maple Magic Arrows
  1352009: ["Mercedes"], // Princess No's Accursed Arrow
  1352010: ["Mercedes"], // Frozen Magic Arrows
  1352011: ["Mercedes"], // Maple Treasure Magic Arrows
  1352012: ["Mercedes"], // Evolving Infinite Magic Arrows
  1352103: ["Phantom"], // Carte Finale
  1352108: ["Phantom"], // Carte Onyx Maple
  1352109: ["Phantom"], // Princess No's Carte
  1352110: ["Phantom"], // Carte Frozen
  1352111: ["Phantom"], // Carte Maple Treasure
  1352112: ["Phantom"], // Evolving Carte Dernier
  1352202: ["Hero"], // Virtues Medallion
  1352203: ["Hero"], // Evolving Virtues Medal
  1352205: ["Hero"], // Onyx Maple Medal
  1352206: ["Hero"], // Princess No's Medal
  1352207: ["Hero"], // Frozen Medal
  1352208: ["Hero"], // Maple Treasure Medal
  1352212: ["Paladin"], // Sacred Rosary
  1352213: ["Paladin"], // Evolving Sacred Rosary
  1352215: ["Paladin"], // Onyx Maple Rosary
  1352216: ["Paladin"], // Princess No's Rosary
  1352217: ["Paladin"], // Frozen Rosary
  1352218: ["Paladin"], // Maple Treasure Rosary
  1352222: ["Dark Knight"], // Berserk Chain
  1352223: ["Dark Knight"], // Evolving Berserk Chain
  1352225: ["Dark Knight"], // Onyx Maple Chain
  1352226: ["Dark Knight"], // Princess No's Flower Chain
  1352227: ["Dark Knight"], // Frozen Chain
  1352228: ["Dark Knight"], // Maple Treasure Chain
  1352232: ["Arch Mage (Fire/Poison)"], // Rusty Book <Epode>
  1352233: ["Arch Mage (Fire/Poison)"], // Evolving Rusty Book <Epode>
  1352235: ["Arch Mage (Fire/Poison)"], // Onyx Maple Rusty Book
  1352236: ["Arch Mage (Fire/Poison)"], // Princess No's Flaming Book
  1352237: ["Arch Mage (Fire/Poison)"], // Frozen Rusty Book
  1352238: ["Arch Mage (Fire/Poison)"], // Maple Treasure Rusty Book
  1352242: ["Arch Mage (Ice/Lightning)"], // Metallic Blue Book <Epode>
  1352243: ["Arch Mage (Ice/Lightning)"], // Evolving Metallic Blue Book <Epode>
  1352245: ["Arch Mage (Ice/Lightning)"], // Onyx Maple Metallic Book
  1352246: ["Arch Mage (Ice/Lightning)"], // Princess No's Damp Book
  1352247: ["Arch Mage (Ice/Lightning)"], // Frozen Metallic Book
  1352248: ["Arch Mage (Ice/Lightning)"], // Maple Treasure Metallic Book
  1352252: ["Bishop"], // White Gold Book <Epode>
  1352253: ["Bishop"], // Evolving White Gold Book <Epode>
  1352255: ["Bishop"], // Onyx Maple White Gold Book
  1352256: ["Bishop"], // Princess No's Golden Book
  1352257: ["Bishop"], // Frozen White Gold Book
  1352258: ["Bishop"], // Maple Treasure White Gold Book
  1352262: ["Bowmaster"], // Blasted Feather
  1352263: ["Bowmaster"], // Evolving Blasted Feather
  1352265: ["Bowmaster"], // Onyx Maple Feather
  1352266: ["Bowmaster"], // Princess No's Feather
  1352267: ["Bowmaster"], // Frozen Feather
  1352268: ["Bowmaster"], // Maple Treasure Feather
  1352272: ["Marksman"], // True Shot
  1352273: ["Marksman"], // Evolving True Shot
  1352275: ["Marksman"], // Onyx Maple True Shot
  1352276: ["Marksman"], // Princess No's Wreath
  1352277: ["Marksman"], // Frozen True Shot
  1352278: ["Marksman"], // Maple Treasure True Shot
  1352282: ["Shadower"], // Slashing Shadow
  1352283: ["Shadower"], // Evolving Slashing Shadow
  1352285: ["Shadower"], // Onyx Maple Shadow
  1352286: ["Shadower"], // Princess No's Purple Shadow
  1352287: ["Shadower"], // Frozen Shadow
  1352288: ["Shadower"], // Maple Treasure Shadow
  1352292: ["NightLord"], // Death Sender Charm
  1352293: ["NightLord"], // Evolving Death Sender Charm
  1352295: ["NightLord"], // Onyx Maple Death Sender Charm
  1352296: ["NightLord"], // Princess No's Charm
  1352297: ["NightLord"], // Frozen Death Sender Charm
  1352298: ["NightLord"], // Maple Treasure Death Sender Charm
  1352303: ["Jett"], // Jett's Core
  1352403: ["Luminous"], // Karma Orb
  1352405: ["Luminous"], // Onyx Maple Orb
  1352406: ["Luminous"], // Princess No's Soul Orb
  1352407: ["Luminous"], // Frozen Orb
  1352408: ["Luminous"], // Maple Treasure Orb
  1352409: ["Luminous"], // Evolving Karma Orb
  1352503: ["Kaiser"], // Nova Truth Essence
  1352505: ["Kaiser"], // Nova Onyx Maple Essence
  1352506: ["Kaiser"], // Princess No's Dragon Essence
  1352507: ["Kaiser"], // Nova Frozen Essence
  1352508: ["Kaiser"], // Maple Treasure Essence
  1352509: ["Kaiser"], // Evolving Nova Truth Essence
  1352604: ["Angelic Buster"], // Green Soul Ring
  1352605: ["Angelic Buster"], // Onyx Maple Soul Ring
  1352606: ["Angelic Buster"], // Princess No's Soul Ring
  1352607: ["Angelic Buster"], // Frozen Soul Ring
  1352608: ["Angelic Buster"], // Maple Treasure Soul Ring
  1352609: ["Angelic Buster"], // Evolving Green Soul Ring
  1352703: ["Mechanic"], // Eternal Magnum
  1352705: ["Mechanic"], // Onyx Maple Magnum
  1352707: ["Mechanic"], // Princess No's Magnum
  1352708: ["Mechanic"], // Frozen Magnum
  1352709: ["Mechanic"], // Maple Treasure Magnum
  1352710: ["Mechanic"], // Evolving Eternal Magnum
  1352803: ["Hayato"], // Fire Phoenix Blade
  1352806: ["Hayato"], // Onyx Maple Blade
  1352807: ["Hayato"], // Princess No's Wakizashi
  1352809: ["Hayato"], // Frozen Tiger Blade
  1352813: ["Lynn"], // Golden Pearl Leaf
  1352814: ["Lynn"], // Onyx Maple Pearl Leaf
  1352815: ["Lynn"], // Princess No's Leaf
  1352817: ["Lynn"], // Frozen Leaf
  1352818: ["Lynn"], // Maple Treasure Leaf
  1352823: ["Jett"], // Arcturus Fist
  1352824: ["Jett"], // Princess No's Orion Fist
  1352825: ["Jett"], // Onyx Maple Claw
  1352827: ["Jett"], // Frozen Maple Claw
  1352828: ["Jett"], // Maple Treasure Fist
  1352830: ["Hayato"], // Maple Treasure Kodachi
  1352832: ["Hayato"], // Evolving Fire Phoenix Blade
  1352840: ["Lynn"], // Evolving Golden Pearl Leaf
  1352863: ["Mo Xuan"], // Boundless Brace Band
  1352864: ["Mo Xuan"], // Frozen Brace Band
  1352865: ["Mo Xuan"], // Onyx Brace Band
  1352866: ["Mo Xuan"], // Evolving Brace Band
  1352867: ["Mo Xuan"], // Princess No's Brace Band
  1352873: ["Sia Astelle"], // Oort Compass
  1352874: ["Sia Astelle"], // Frozen Compass
  1352875: ["Sia Astelle"], // Onyx Compass
  1352876: ["Sia Astelle"], // Evolving Compass
  1352877: ["Sia Astelle"], // Maple Treasure Compass
  1352878: ["Sia Astelle"], // Princess No's Compass
  1352883: ["Erel"], // Imper Keir
  1352884: ["Erel"], // Frozen Keir
  1352885: ["Erel"], // Onyx Keir
  1352886: ["Erel"], // Evolving Keir
  1352887: ["Erel"], // Maple Treasure Keir
  1352888: ["Erel"], // Princess No's Keir
  1352902: ["Buccaneer"], // Wrist Armor
  1352903: ["Buccaneer"], // Evolving Wrist Armor
  1352905: ["Buccaneer"], // Onyx Maple Wrist Armor
  1352906: ["Buccaneer"], // Princess No's Skull Armor
  1352907: ["Buccaneer"], // Frozen Wrist Armor
  1352908: ["Buccaneer"], // Maple Treasure Wrist Armor
  1352912: ["Corsair"], // Falcon Eye
  1352913: ["Corsair"], // Evolving Falcon Eye
  1352915: ["Corsair"], // Onyx Maple Falcon Eye
  1352916: ["Corsair"], // Princess No's Falcon Eye
  1352917: ["Corsair"], // Frozen Falcon Eye
  1352918: ["Corsair"], // Maple Treasure Falcon Eye
  1352922: ["Cannoneer"], // Center Fire Bomb
  1352923: ["Cannoneer"], // Evolving Center Fire Bomb
  1352926: ["Cannoneer"], // Reforged Center Fire Bomb
  1352927: ["Cannoneer"], // Onyx Maple Center Fire Bomb
  1352928: ["Cannoneer"], // Princess No's Fire Bomb
  1352929: ["Cannoneer"], // Frozen Center Fire Bomb
  1352932: ["Aran"], // Dragon Mass
  1352933: ["Aran"], // Evolving Dragon Mass
  1352934: ["Aran"], // Onyx Maple Dragon Mass
  1352935: ["Aran"], // Princess No's Flower Ballast
  1352936: ["Aran"], // Frozen Dragon Mass
  1352937: ["Aran"], // Maple Treasure Dragon Mass
  1352942: ["Evan"], // Dragon Master's Legacy
  1352943: ["Evan"], // Evolving Dragon Master's Legacy
  1352944: ["Evan"], // Onyx Maple Dragon Master's Legacy
  1352945: ["Evan"], // Princess No's Dragon Legacy
  1352946: ["Evan"], // Frozen Dragon Master's Legacy
  1352947: ["Evan"], // Maple Treasure Legacy
  1352952: ["Battle Mage"], // Maximizer Ball
  1352953: ["Battle Mage"], // Evolving Maximizer Ball
  1352955: ["Battle Mage"], // Onyx Maple Maximizer Ball
  1352957: ["Battle Mage"], // Princess No's Accursed Marble
  1352958: ["Battle Mage"], // Frozen Maximizer Ball
  1352959: ["Battle Mage"], // Maple Treasure Equalizer Ball
  1352962: ["Wild Hunter"], // Wild Heron
  1352963: ["Wild Hunter"], // Evolving Wild Heron
  1352965: ["Wild Hunter"], // Onyx Maple Wild Heron
  1352967: ["Wild Hunter"], // Princess No's Arrowhead
  1352968: ["Wild Hunter"], // Frozen Wild Heron
  1352969: ["Wild Hunter"], // Maple Treasure Wild Beak
  1352972: ["Dawn Warrior","Blaze Wizard","Wind Archer","Night Walker","Thunder Breaker"], // Ereve Brilliance
  1352973: ["Dawn Warrior","Blaze Wizard","Wind Archer","Night Walker","Thunder Breaker"], // Evolving Ereve Brilliance
  1352974: ["Dawn Warrior","Blaze Wizard","Wind Archer","Night Walker","Thunder Breaker"], // Onyx Maple Ereve Brilliance
  1352975: ["Dawn Warrior","Blaze Wizard","Wind Archer","Night Walker","Thunder Breaker"], // Princess No's Floral Jewel
  1352976: ["Dawn Warrior","Blaze Wizard","Wind Archer","Night Walker","Thunder Breaker"], // Frozen Ereve Brilliance
  1352977: ["Dawn Warrior","Blaze Wizard","Wind Archer","Night Walker","Thunder Breaker"], // Maple Treasure Ereve Brilliance
  1352980: ["Cannoneer"], // Maple Treasure Center Fire Bomb
  1353004: ["Xenon"], // Octa Core Controller
  1353005: ["Xenon"], // Onyx Maple Octo Core Controller
  1353006: ["Xenon"], // Princess No's Controller
  1353007: ["Xenon"], // Frozen Octo Core Controller
  1353008: ["Xenon"], // Maple Treasure Controller
  1353009: ["Xenon"], // Evolving Octo Core Controller
  1353103: ["Shade"], // Golden Fox Marble
  1353104: ["Shade"], // Onyx Maple Fox Marble
  1353105: ["Shade"], // Princess No's Fox Marble
  1353106: ["Shade"], // Frozen Fox Marble
  1353107: ["Shade"], // Maple Treasure Fox Marble
  1353108: ["Shade"], // Evolving Golden Fox Marble
  1353203: ["Kinesis"], // Queen Chess Piece
  1353204: ["Kinesis"], // Frozen Queen Chess Piece
  1353205: ["Kinesis"], // Princess No's Oriental King Chess Piece
  1353206: ["Kinesis"], // Maple Treasure Chess Piece
  1353207: ["Kinesis"], // Onyx Maple Queen Chess Piece
  1353208: ["Kinesis"], // Evolving Queen Chess Piece
  1353303: ["Cadena"], // Transmitter Type-A
  1353304: ["Cadena"], // Frozen Transmitter
  1353306: ["Cadena"], // Princess No's Transmitter
  1353307: ["Cadena"], // Onyx Maple Transmitter
  1353308: ["Cadena"], // Evolving Transmitter Type-A
  1353403: ["Blaster"], // Masterwork Charges
  1353404: ["Blaster"], // Frozen Charges
  1353405: ["Blaster"], // Princess No's Megaton Charges
  1353407: ["Blaster"], // Evolving Masterwork Charges
  1353408: ["Blaster"], // Onyx Maple Charges
  1353503: ["Illium"], // Glory Lucent Wings
  1353504: ["Illium"], // Frozen Lucent Wings
  1353505: ["Illium"], // Princess No's Lucent Wings
  1353506: ["Illium"], // Onyx Maple Lucent Wings
  1353507: ["Illium"], // Evolving Glory Lucent Wings
  1353603: ["Ark"], // Ultimate Path
  1353604: ["Ark"], // Frozen Path
  1353605: ["Ark"], // Onyx Maple Path
  1353606: ["Ark"], // Princess No's Path
  1353607: ["Ark"], // Evolving Ultimate Path
  1353703: ["Pathfinder"], // Perfect Relic
  1353704: ["Pathfinder"], // Frozen Relic
  1353705: ["Pathfinder"], // Evolving Perfect Relic
  1353706: ["Pathfinder"], // Onyx Maple Relic
  1353707: ["Pathfinder"], // Princess No's Immortal Relic
  1353708: ["Pathfinder"], // Maple Treasure Relic
  1353803: ["Hoyoung"], // Moonstone Fan Tassel
  1353804: ["Hoyoung"], // Frozen Fan Tassel
  1353805: ["Hoyoung"], // Onyx Maple Fan Tassel
  1353806: ["Hoyoung"], // Evolving Moonstone Fan Tassel
  1353807: ["Hoyoung"], // Princess No's Fan Tassel
  1354003: ["Adele"], // Noble Bladebinder
  1354004: ["Adele"], // Frozen Shiny Bladebinder
  1354005: ["Adele"], // Onyx Maple Shiny Bladebinder
  1354006: ["Adele"], // Evolving Noble Bladebinder
  1354007: ["Adele"], // Princess No's Immortal Bladebinder
  1354013: ["Kain"], // D100 Custom Weapon Belt
  1354014: ["Kain"], // Frozen D100 Weapon Belt
  1354015: ["Kain"], // Onyx Maple D100 Weapon Belt
  1354016: ["Kain"], // Evolving D100 Weapon Belt
  1354017: ["Kain"], // Princess No's Immortal Weapon Belt
  1354023: ["Lara"], // Radiant Four-Jade Ornament
  1354024: ["Lara"], // Frozen Four-Jade Ornament
  1354025: ["Lara"], // Onyx Maple Four-Jade Ornament
  1354026: ["Lara"], // Evolving Four-Jade Ornament
  1354027: ["Lara"], // Princess No's Immortal Four-Jade Ornament
  1354033: ["Khali"], // Infinite Hex Seeker
  1354034: ["Khali"], // Frozen Infinite Hex Seeker
  1354035: ["Khali"], // Onyx Maple Infinite Hex Seeker
  1354036: ["Khali"], // Evolving Infinite Hex Seeker
  1354037: ["Khali"], // Princess No's Immortal Hex Seeker
  1354043: ["Ren"], // Violet Imugi Gem
  1354044: ["Ren"], // Onyx Imugi Gem
  1354045: ["Ren"], // Frozen Imugi Gem
  1354046: ["Ren"], // Evolving Violet Imugi Gem
  1354049: ["Ren"], // Princess No's Imugi Gem
  1354303: ["Kanna"], // Shikigami Talisman
  1354304: ["Kanna"], // Evolving Shikigami Talisman
  1354305: ["Kanna"], // Frozen Talisman
  1354306: ["Kanna"], // Onyx Talisman
  1354307: ["Kanna"], // Princess No's Talisman
  1354308: ["Kanna"], // Pandemonium Talisman
  1354309: ["Kanna"], // Thousand Soul Talisman
  1354310: ["Kanna"], // Astra Talisman
  1720000: ["Hero"], // Astra Medallion
  1720100: ["Paladin"], // Astra Rosary
  1720200: ["Dark Knight"], // Astra Chain
  1720600: ["Bowmaster"], // Astra Feather
  1720700: ["Marksman"], // Astra Bullseye
  1720800: ["Pathfinder"], // Astra Relic
  1720900: ["NightLord"], // Astra Charm
  1721100: ["Buccaneer"], // Astra Wrist Band
  1721200: ["Corsair"], // Astra Raven Eye
  1721300: ["Cannoneer"], // Astra Incendiary
  1721400: ["Dawn Warrior"], // Astra Topaz
  1721600: ["Wind Archer"], // Astra Emerald
  1721700: ["Night Walker"], // Astra Obsidian
  1721800: ["Thunder Breaker"], // Astra Sapphire
  1721900: ["Aran"], // Astra White Tiger Pendulum
  1722100: ["Mercedes"], // Astra Magic Arrows
  1722200: ["Phantom"], // Astra Carte
  1722300: ["Luminous"], // Astra Orb
  1722400: ["Shade"], // Astra Fox Marble
  1722800: ["Wild Hunter"], // Astra Wild Tusk
  1722900: ["Mechanic"], // Astra Magnum
  1723000: ["Xenon"], // Astra Deca Core Controller
  1723100: ["Blaster"], // Astra Charges
  1723300: ["Kaiser"], // Astra Nova Essence
  1723400: ["Kain"], // Astra Weapon Belt
  1723500: ["Cadena"], // Astra Transmitter
  1723600: ["Angelic Buster"], // Astra Soul Ring
  1723700: ["Zero"], // Astra Hourglass
  1723800: ["Kinesis"], // Astra King Chess Piece
  1723900: ["Adele"], // Astra Bladebinder
  1724000: ["Illium"], // Astra Lucent Wings
  1724100: ["Khali"], // Astra Hex Seeker
  1724200: ["Ark"], // Astra Path
  1724300: ["Ren"], // Astra Imugi Gem
  1724400: ["Lara"], // Astra Four-Jade Ornament
  1724500: ["Hoyoung"], // Astra Diamond Fan Tassel
  1725000: ["Hayato"], // Astra Kodachi
  1725200: ["Mo Xuan"], // Astra Brace Band
  1725300: ["Sia Astelle"], // Astra Compass
  1725400: ["Erel"], // Astra Keir
}

export function secondarySupportsJob(item, mapleClass) {
  return SECONDARY_JOBS[item.itemid]?.includes(mapleClass) ?? false
}
