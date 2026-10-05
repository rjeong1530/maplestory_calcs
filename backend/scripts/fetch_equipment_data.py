"""Export equipment, level 100-250 secondaries, and selected hearts from MapleStory.io."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from itertools import repeat
from http.client import HTTPException
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = 'https://maplestory.io'
OUTPUT = Path(__file__).resolve().parents[2] / 'frontend/src/data/equipment_140_250.json'
SLOTS = {
    'Face Accessory': 'face', 'Eye Decoration': 'eye', 'Earrings': 'earring',
    'Pendant': 'pendant', 'Belt': 'belt', 'Medal': 'medal',
    'Shoulder Accessory': 'shoulder', 'Pocket Item': 'pocket', 'Badge': 'badge',
    'Emblem': 'emblem', 'Mechanical Heart': 'heart', 'Hat': 'hat', 'Cape': 'cape',
    'Top': 'top', 'Glove': 'gloves', 'Overall': 'overall', 'Bottom': 'bottom',
    'Ring': 'ring', 'Shield': 'secondary', 'Shoes': 'shoes', 'Mount': 'mount',
    'Android': 'android', 'Katara': 'secondary',
}
CLASSES = {'Beginner', 'Warrior', 'Magician', 'Bowman', 'Thief', 'Pirate'}
HEART_NAMES = {'Fairy Heart', 'Titanium Heart', 'Plasma Heart', 'Outlaw Heart', 'Total Control'}
EARRING_NAMES = {'Commanding Force Earring', 'Estella Earrings', 'Superior Gollux Earrings'}
EXCLUDED_NAME_PREFIXES = ('Red Beryl', 'Frontier', 'Commerci')
POCKET_NAMES = {'Pink Holy Cup', 'Cursed Red Spellbook', 'Cursed Blue Spellbook',
                'Cursed Green Spellbook', 'Cursed Yellow Spellbook'}
HEART_PARAMS = {'subCategoryFilter': 'Mechanical Heart'}
MITRA_EMBLEM_IDS = frozenset(range(1190555, 1190560))
ARMOR_SLOTS = {'hat', 'top', 'overall', 'bottom', 'gloves', 'shoes', 'cape', 'shoulder'}
CRA_HATS = {'Royal Warrior Helm', 'Royal Dunwitch Hat', 'Royal Ranger Beret',
            'Royal Assassin Hood', 'Royal Wanderer Hat', "Chaos Vellum's Helm"}


def keep_equipment(item):
    if item['slot'] == 'earring':
        return item['name'] in EARRING_NAMES
    if item['slot'] == 'eye' and item['name'] == "Bounty Legend's Sunglasses":
        return False
    if item['name'].startswith(EXCLUDED_NAME_PREFIXES):
        return False
    if item['slot'] == 'pocket':
        return item['name'] in POCKET_NAMES
    if item['slot'] == 'heart':
        return item['name'] in HEART_NAMES
    if item['slot'] == 'secondary':
        if not 100 <= item['level'] <= 250:
            return False
        if item['itemid'] // 10000 == 134:
            return item['name'].startswith(('Fafnir ', 'AbsoLab ', 'Sweetwater ', 'Arcane Umbra ', 'Astra '))
        # Ordinary shields occupy 1092xxx. Soul/Force Shields are separate
        # job-specific secondaries, even though the source calls them Shields.
        if item['itemid'] // 1000 == 1092:
            return item['name'].startswith(('Astra ', 'Deimos ', 'Terminus '))
        return True
    if item['slot'] == 'weapon':
        return item['name'].startswith(('Fafnir ', 'AbsoLab ', 'AbsoLabV ',
                                        'Arcane Umbra ', 'Genesis ', 'Sealed Genesis ', 'Destiny '))
    if item['slot'] not in ARMOR_SLOTS:
        return True
    name = item['name']
    return (name.startswith(('AbsoLab ', 'Arcane Umbra ', 'Eternal '))
            or (item['slot'] == 'hat' and name in CRA_HATS)
            or (item['slot'] == 'top' and name.startswith('Eagle Eye '))
            or (item['slot'] == 'bottom' and name.startswith('Trixter ')))


def write_catalog(items, metadata):
    filtered = catalog_items(items)
    for item in filtered:
        item.setdefault('boss_reward', False)
    metadata.update({
        'item_count': len(filtered),
        'armor_filter': {
            'sets': ['Chaos Root Abyss', 'AbsoLab', 'Arcane Umbra', 'Eternal'],
            'slots': sorted(ARMOR_SLOTS),
            'includes': "CRA Royal hats, Eagle Eye tops, Trixter bottoms, and Chaos Vellum's Helm.",
        },
        'weapon_filter': {
            'series': ['Fafnir', 'AbsoLab', 'Arcane Umbra', 'Genesis', 'Destiny'],
            'scope': 'Main weapons only; secondaries, including kataras, are included from level 100.',
            'includes': 'Sealed Genesis and AbsoLabV variants.',
        },
        'deduplication': 'Exact item name; retain the entry with the lowest item ID.',
        'boss_reward_semantics': 'MapleStory.io item-detail metaInfo.bossReward; missing or non-boolean values default to false.',
        'filtered_at': datetime.now(timezone.utc).isoformat(),
        'coverage': 'Level 140-250 equipment plus level 100-250 secondaries and selected hearts at all levels. Includes secondary IDs and Mitra emblem IDs mislabeled Unknown by the source. Armor and main weapons retain their set/series filters. Presence does not imply current obtainability.',
        'secondary_min_level': 100,
        'heart_filter': sorted(HEART_NAMES),
        'earring_filter': sorted(EARRING_NAMES),
        'excluded_name_prefixes': list(EXCLUDED_NAME_PREFIXES),
        'excluded_eye_items': ["Bounty Legend's Sunglasses"],
        'pocket_filter': sorted(POCKET_NAMES),
        'katara_filter': ['Fafnir', 'AbsoLab', 'Sweetwater', 'Arcane Umbra', 'Astra'],
        'shield_filter': {
            'series': ['Astra', 'Deimos', 'Terminus'],
            'scope': 'Ordinary shields (1092xxx); Soul Shields and Force Shields are unchanged.',
        },
        'counts_by_slot': dict(sorted(Counter(item['slot'] for item in filtered).items())),
    })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(filtered, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    OUTPUT.with_suffix('.meta.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {OUTPUT} ({len(filtered)} entries; removed {len(items) - len(filtered)} entries)', flush=True)


def fetch_json(url):
    for attempt in range(3):
        try:
            request = Request(url, headers={'User-Agent': 'MapleEquipmentCatalog/1.0'})
            with urlopen(request, timeout=90) as response:
                return json.load(response)
        except (OSError, ValueError, HTTPException):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def catalog_items(items):
    unique_names = {}
    for item in sorted(items, key=lambda item: item['itemid']):
        if keep_equipment(item):
            unique_names.setdefault(item['name'], item)
    return list(unique_names.values())


def fetch_boss_reward(item_id, version):
    detail = fetch_json(f'{BASE}/api/GMS/{version}/item/{item_id}')
    if detail is None:
        return False
    if not isinstance(detail, dict):
        raise ValueError(f'Expected item detail object for MapleStory.io item {item_id}')
    meta_info = detail.get('metaInfo')
    if not isinstance(meta_info, dict):
        return False
    status = meta_info.get('bossReward')
    return status if isinstance(status, bool) else False


def add_boss_reward_status(items, version):
    selected_items = catalog_items(items)
    with ThreadPoolExecutor(max_workers=8) as executor:
        statuses = executor.map(
            fetch_boss_reward,
            (item['itemid'] for item in selected_items),
            repeat(version),
        )
        counts = Counter()
        for index, (item, status) in enumerate(zip(selected_items, statuses), start=1):
            item['boss_reward'] = status
            counts[status] += 1
            if index % 50 == 0 or index == len(selected_items):
                print(f'GMS {version}: loaded boss status for {index}/{len(selected_items)} '
                      f'equipment entries', flush=True)
    print(f'Boss reward status: {counts[True]} true, {counts[False]} false', flush=True)


def is_secondary_id(item_id):
    return item_id // 10000 in (109, 134, 135, 172)


def in_catalog_scope(item):
    level = item.get('requiredLevel')
    if not isinstance(level, int):
        return False
    if item['id'] in MITRA_EMBLEM_IDS:
        return 140 <= level <= 250 and bool(item.get('name', '').strip())
    if item.get('typeInfo', {}).get('subCategory') == 'Mechanical Heart':
        return level >= 0 and bool(item.get('name', '').strip())
    if is_secondary_id(item['id']):
        return 100 <= level <= 250 and bool(item.get('name', '').strip())
    return item.get('typeInfo', {}).get('overallCategory') == 'Equip' and 140 <= level <= 250


def normalize(item):
    info = item['typeInfo']
    level = item['requiredLevel']
    if not in_catalog_scope(item):
        raise ValueError(f"Unexpected equipment/level: {item['id']}")
    category, kind = info['category'], info['subCategory']
    slot = 'secondary' if is_secondary_id(item['id']) else SLOTS.get(kind)
    if item['id'] in MITRA_EMBLEM_IDS:
        slot, kind = 'emblem', 'Emblem'
    if slot == 'secondary' and kind == 'Unknown':
        kind = 'Secondary Weapon'
    if slot is None:
        if category == 'Secondary Weapon':
            slot = 'secondary'
        elif category in ('One-Handed Weapon', 'Two-Handed Weapon'):
            slot = 'weapon'
        else:
            raise ValueError(f'Unmapped slot: {category} / {kind}')
    jobs = item.get('requiredJobs')
    if not jobs or not set(jobs) <= CLASSES:
        raise ValueError(f"Unknown class restrictions: {item['id']} / {jobs}")
    # The API calls reqJob=0 "Beginner"; 0 is an unrestricted class mask.
    # Source: Services/Implementations/MapleStory/ItemFactory.cs JobNameLookup.
    classes = ['All'] if jobs == ['Beginner'] else jobs
    if not item.get('name', '').strip():
        raise ValueError(f"Unnamed equipment: {item['id']}")
    return {'itemid': item['id'], 'name': item['name'], 'slot': slot,
            'class': classes, 'level': level, 'equipment_type': kind,
            'boss_reward': item.get('bossReward') if isinstance(item.get('bossReward'), bool) else False}


def fetch_hearts(version):
    """Fetch every heart level, then retain the requested exact names."""
    endpoint = f'{BASE}/api/GMS/{version}/item'
    items, seen = [], set()
    start, page_size = 0, 500
    while True:
        page = fetch_json(f'{endpoint}?{urlencode(dict(HEART_PARAMS, startPosition=start, count=page_size))}')
        if not isinstance(page, list):
            raise ValueError('Expected a list of hearts')
        for raw in page:
            if raw['id'] in seen:
                raise ValueError('Duplicate heart ID or repeated API page')
            seen.add(raw['id'])
            if raw.get('typeInfo', {}).get('subCategory') != 'Mechanical Heart':
                raise ValueError('Heart query returned a different equipment type')
            if raw.get('name') in HEART_NAMES:
                items.append(normalize(raw))
        if len(page) < page_size:
            break
        start += len(page)
    items = catalog_items(items)
    missing = HEART_NAMES - {item['name'] for item in items}
    if missing:
        raise ValueError(f'Missing requested hearts: {sorted(missing)}; catalog not overwritten')
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', help='GMS snapshot; defaults to newest ready numeric version')
    parser.add_argument('--filter-existing', action='store_true', help='Apply equipment filters locally without downloading')
    parser.add_argument('--refresh-secondaries', action='store_true',
                        help='Refresh secondary records only, preserving other bundled equipment')
    parser.add_argument('--refresh-hearts', action='store_true',
                        help='Refresh the five selected hearts at all levels, preserving other equipment')
    args = parser.parse_args()
    if sum((args.filter_existing, args.refresh_secondaries, args.refresh_hearts)) > 1:
        parser.error('Choose only one of --filter-existing, --refresh-secondaries, or --refresh-hearts')
    if args.filter_existing:
        write_catalog(json.loads(OUTPUT.read_text(encoding='utf-8')),
                      json.loads(OUTPUT.with_suffix('.meta.json').read_text(encoding='utf-8')))
        return
    version = args.version
    partial_refresh = args.refresh_secondaries or args.refresh_hearts
    existing_metadata = json.loads(OUTPUT.with_suffix('.meta.json').read_text(encoding='utf-8')) if partial_refresh else None
    if partial_refresh and not version:
        version = existing_metadata['version']
    if partial_refresh and version != existing_metadata['version']:
        raise ValueError('Partial refresh must use the existing catalog version.')
    if not version:
        versions = fetch_json(f'{BASE}/api/wz')
        version = str(max(int(row['mapleVersionId']) for row in versions
                          if row['region'] == 'GMS' and row['isReady']
                          and row['mapleVersionId'].isdigit()))
    endpoint = f'{BASE}/api/GMS/{version}/item'
    if args.refresh_hearts:
        hearts = fetch_hearts(version)
        add_boss_reward_status(hearts, version)
        existing = json.loads(OUTPUT.read_text(encoding='utf-8'))
        existing_metadata['heart_source_url'] = f'{endpoint}?{urlencode(HEART_PARAMS)}'
        existing_metadata['hearts_retrieved_at'] = datetime.now(timezone.utc).isoformat()
        write_catalog([item for item in existing if item['slot'] != 'heart'] + hearts, existing_metadata)
        return
    # Do not filter overallCategory: newer 135xxxx/172xxxx secondaries are
    # reported as Unknown by the source's category lookup.
    params = {'minLevelFilter': 100, 'maxLevelFilter': 250}
    items, seen = [], set()
    page_size = 500
    start = 0
    while True:
        page = fetch_json(f'{endpoint}?{urlencode(dict(params, startPosition=start, count=page_size))}')
        if not isinstance(page, list):
            raise ValueError('Expected a list of equipment')
        for raw in page:
            if not in_catalog_scope(raw) or (args.refresh_secondaries and not is_secondary_id(raw['id'])):
                continue
            item = normalize(raw)
            if item['itemid'] in seen:
                raise ValueError('Duplicate item ID or repeated API page')
            seen.add(item['itemid'])
            items.append(item)
        print(f'GMS {version}: loaded {len(items)} equipment entries', flush=True)
        if len(page) < page_size:
            break
        start += len(page)
    if not items:
        raise ValueError('Source returned no equipment; existing catalog was not overwritten')
    if not args.refresh_secondaries:
        items = [item for item in items if item['slot'] != 'heart'] + fetch_hearts(version)
    items.sort(key=lambda item: item['itemid'])
    add_boss_reward_status(items, version)
    if args.refresh_secondaries:
        existing = json.loads(OUTPUT.read_text(encoding='utf-8'))
        existing_metadata['secondary_source_url'] = f'{endpoint}?{urlencode(params)}'
        existing_metadata['secondaries_retrieved_at'] = datetime.now(timezone.utc).isoformat()
        write_catalog([item for item in existing if item['slot'] != 'secondary'] + items, existing_metadata)
        return
    metadata = {
        'source': BASE, 'region': 'GMS', 'version': version,
        'source_url': f'{endpoint}?{urlencode(params)}',
        'retrieved_at': datetime.now(timezone.utc).isoformat(),
        'heart_source_url': f'{endpoint}?{urlencode(HEART_PARAMS)}',
        'hearts_retrieved_at': datetime.now(timezone.utc).isoformat(),
        'min_level': 140, 'max_level': 250, 'item_count': len(items),
        'class_semantics': 'Broad reqJob class families, not exact playable jobs. All means no family restriction. Weapon type and special job restrictions may further limit eligibility.',
        'coverage': 'All named Equip entries returned by this GMS snapshot in the inclusive level range. Includes legacy/event and mount equipment; presence does not imply current obtainability. Newer patches or other regions may contain additional items.',
        'slot_semantics': 'Overall has its own slot value; shields and kataras use secondary. Repeated ring/pendant positions share one slot type.',
        'counts_by_slot': dict(sorted(Counter(item['slot'] for item in items).items())),
    }
    write_catalog(items, metadata)


if __name__ == '__main__':
    main()
