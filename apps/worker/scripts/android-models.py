"""
Rebuilds src/android-models.json: Android model codes ("SM-A175F") -> the name people know
("Samsung Galaxy A17"), from Google Play's public list of devices, for the brands sold in
Uzbekistan. Run from apps/worker:  python3 -I scripts/android-models.py
"""
import csv, io, json, urllib.request

URL = 'https://storage.googleapis.com/play_public/supported_devices.csv'
BRANDS = {'samsung', 'xiaomi', 'redmi', 'poco', 'honor', 'huawei', 'tecno', 'infinix', 'itel', 'realme',
          'oppo', 'vivo', 'oneplus', 'google', 'motorola', 'nokia', 'artel', 'zte', 'nothing'}

raw = urllib.request.urlopen(URL).read().decode('utf-16')
names = {}
for row in csv.DictReader(io.StringIO(raw)):
    brand, name, model = row['Retail Branding'].strip(), row['Marketing Name'].strip(), row['Model'].strip()
    if brand.lower() not in BRANDS or not name or not model or model in names or name.lower() == model.lower():
        continue
    names[model] = name if name.lower().startswith(brand.lower()) else f'{brand} {name}'
with open('src/android-models.json', 'w') as f:
    json.dump(dict(sorted(names.items())), f, ensure_ascii=False, separators=(',', ':'))
print(len(names), 'models')
