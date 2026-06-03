import urllib.request
import json

scr_ids = [
    'undervalued_growth_stocks', 
    'aggressive_small_caps', 
    'undervalued_large_caps', 
    'growth_technology_stocks', 
    'portfolio_anchors', 
    'solid_large_growth_funds'
]

for sid in scr_ids:
    url = f'https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds={sid}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
            results = data.get('finance', {}).get('result', [])
            if results and len(results[0].get('quotes', [])) > 0:
                print(f'{sid}: Success! Quotes: {len(results[0]["quotes"])}')
            else:
                print(f'{sid}: No quotes returned')
    except Exception as e:
        print(f'{sid}: Failed - {e}')
