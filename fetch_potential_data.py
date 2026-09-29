"""Refresh the bundled Legendary KMS tables from Nexon's public disclosure."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from http.cookiejar import CookieJar
import json
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import build_opener, HTTPCookieProcessor, Request

BASE = 'https://maplestory.nexon.com/Guide/OtherProbability/cube/'
LEVELS = (100, 140, 150, 160, 200, 250)
PARTS = {'weapon': 1, 'emblem': 2, 'secondary weapon': 3,
         'force shield': 4, 'soul ring': 4, 'shield': 5, 'hat': 6,
         'top': 7, 'outfit': 8, 'bottom': 9, 'shoes': 10, 'gloves': 11,
         'cape': 12, 'belt': 13, 'shoulder accessory': 14, 'accessory': 15,
         'heart': 20}

def _fetch(job):
    cube, equipment, level = job
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    opener.open(BASE + cube, timeout=60).read()
    body = urlencode(dict(nCubeItemID={'red': 5062009, 'black': 5062010}[cube],
                         nGrade=4, nPartsType=PARTS[equipment], nReqLev=level)).encode()
    request = Request(BASE + 'GetSearchProbList', data=body,
                      headers={'X-Requested-With': 'XMLHttpRequest', 'Referer': BASE + cube})
    html = opener.open(request, timeout=60).read().decode('utf-8-sig')
    if '장비 분류 및 장비 레벨에 해당하는 장비 아이템이 없습니다.' in html:
        return '|'.join(map(str, job)), None
    tables = []
    for table in re.findall(r'<table\b[^>]*>(.*?)</table>', html, re.S):
        rows = []
        for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', table, re.S):
            cells = [unescape(re.sub('<[^>]+>', '', c)).strip()
                     for c in re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S)]
            if len(cells) == 2 and re.fullmatch(r'[\d.]+%', cells[1]):
                rows.append([cells[0], float(cells[1][:-1]) / 100])
        if rows:
            tables.append(rows)
    if len(tables) != 3 or any(abs(sum(p for _, p in t) - 1) > 0.0001 for t in tables):
        raise ValueError(f'Unexpected probability response for {job}: {[sum(p for _, p in t) for t in tables]}')
    return '|'.join(map(str, job)), tables

def fetch(job):
    for attempt in range(4):
        try:
            return _fetch(job)
        except Exception:
            if attempt == 3:
                raise

if __name__ == '__main__':
    jobs = [(c, e, l) for c in ('red', 'black') for e in PARTS for l in LEVELS]
    result = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for future in as_completed([pool.submit(fetch, job) for job in jobs]):
            key, tables = future.result()
            result[key] = tables
            if len(result) % 24 == 0:
                print(f'Fetched {len(result)}/{len(jobs)} tables', flush=True)
    payload = dict(source=BASE, retrieved_at=datetime.now(timezone.utc).isoformat(),
                   grade='Legendary', tables=dict(sorted(result.items())))
    Path(__file__).with_name('potential_data.json').write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
