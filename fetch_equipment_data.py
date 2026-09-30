"""Export the level 140-250 equipment catalog from MapleStory.io (stdlib only)."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from itertools import repeat
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = 'https://maplestory.io'
OUTPUT = Path(__file__).parent / 'frontend/src/data/equipment_140_250.json'
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
ARMOR_SLOTS = {'hat', 'top', 'overall', 'bottom', 'gloves', 'shoes', 'cape', 'shoulder'}
CRA_HATS = {'Royal Warrior Helm', 'Royal Dunwitch Hat', 'Royal Ranger Beret',
            'Royal Assassin Hood', 'Royal Wanderer Hat', 'Chaos Pierre Hat',
            'Chaos Von Bon Helmet', "Chaos Queen's Tiara", "Chaos Vellum's Helm"}


def keep_equipment(item):
    if item['slot'] == 'weapon' or item['equipment_type'] == 'Katara':
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
            'includes': 'CRA Royal hats, Eagle Eye tops, Trixter bottoms, and Chaos Root Abyss boss hats.',
        },
        'weapon_filter': {
            'series': ['Fafnir', 'AbsoLab', 'Arcane Umbra', 'Genesis', 'Destiny'],
            'scope': 'Main weapons and kataras; other secondary equipment is unchanged.',
            'includes': 'Sealed Genesis and AbsoLabV variants.',
        },
        'deduplication': 'Exact item name; retain the entry with the lowest item ID.',
        'boss_reward_semantics': 'MapleStory.io item-detail metaInfo.bossReward; missing or non-boolean values default to false.',
        'filtered_at': datetime.now(timezone.utc).isoformat(),
        'coverage': 'Named Equip entries in the inclusive level range from this GMS snapshot, with armor and weapons restricted to the documented sets and series. Other equipment is unfiltered. Includes legacy/event and mount equipment; presence does not imply current obtainability. Newer patches or other regions may contain additional items.',
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
        except (OSError, ValueError):
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


def normalize(item):
    info = item['typeInfo']
    level = item['requiredLevel']
    if info['overallCategory'] != 'Equip' or not 140 <= level <= 250:
        raise ValueError(f"Unexpected equipment/level: {item['id']}")
    category, kind = info['category'], info['subCategory']
    slot = SLOTS.get(kind)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', help='GMS snapshot; defaults to newest ready numeric version')
    parser.add_argument('--filter-existing', action='store_true', help='Apply equipment filters locally without downloading')
    args = parser.parse_args()
    if args.filter_existing:
        write_catalog(json.loads(OUTPUT.read_text(encoding='utf-8')),
                      json.loads(OUTPUT.with_suffix('.meta.json').read_text(encoding='utf-8')))
        return
    version = args.version
    if not version:
        versions = fetch_json(f'{BASE}/api/wz')
        version = str(max(int(row['mapleVersionId']) for row in versions
                          if row['region'] == 'GMS' and row['isReady']
                          and row['mapleVersionId'].isdigit()))
    endpoint = f'{BASE}/api/GMS/{version}/item'
    params = {'overallCategoryFilter': 'Equip', 'minLevelFilter': 140, 'maxLevelFilter': 250}
    items, seen = [], set()
    page_size = 500
    while True:
        page = fetch_json(f'{endpoint}?{urlencode(dict(params, startPosition=len(items), count=page_size))}')
        if not isinstance(page, list):
            raise ValueError('Expected a list of equipment')
        for raw in page:
            item = normalize(raw)
            if item['itemid'] in seen:
                raise ValueError('Duplicate item ID or repeated API page')
            seen.add(item['itemid'])
            items.append(item)
        print(f'GMS {version}: loaded {len(items)} equipment entries', flush=True)
        if len(page) < page_size:
            break
    if not items:
        raise ValueError('Source returned no equipment; existing catalog was not overwritten')
    items.sort(key=lambda item: item['itemid'])
    add_boss_reward_status(items, version)
    metadata = {
        'source': BASE, 'region': 'GMS', 'version': version,
        'source_url': f'{endpoint}?{urlencode(params)}',
        'retrieved_at': datetime.now(timezone.utc).isoformat(),
        'min_level': 140, 'max_level': 250, 'item_count': len(items),
        'class_semantics': 'Broad reqJob class families, not exact playable jobs. All means no family restriction. Weapon type and special job restrictions may further limit eligibility.',
        'coverage': 'All named Equip entries returned by this GMS snapshot in the inclusive level range. Includes legacy/event and mount equipment; presence does not imply current obtainability. Newer patches or other regions may contain additional items.',
        'slot_semantics': 'Overall has its own slot value; shields and kataras use secondary. Repeated ring/pendant positions share one slot type.',
        'counts_by_slot': dict(sorted(Counter(item['slot'] for item in items).items())),
    }
    write_catalog(items, metadata)


if __name__ == '__main__':
    main()
