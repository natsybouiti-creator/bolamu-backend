import re
import base64
import json

with open('public/patient/Bolamu Dashboard V3.html', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'<script type="__bundler/template">(.+?)</script>', content, re.DOTALL)

if match:
    try:
        template = json.loads(match.group(1))
        # Le template est en base64
        decoded = base64.b64decode(template).decode('utf-8')
        with open('public/patient/dashboard-v3-extracted.html', 'w', encoding='utf-8') as out:
            out.write(decoded)
        print(f'Template extrait: {len(decoded)} caractères')
    except Exception as e:
        print(f'Erreur: {e}')
        print(f'Premiers 100 chars du template: {template[:100]}')
else:
    print('Template non trouvé')
