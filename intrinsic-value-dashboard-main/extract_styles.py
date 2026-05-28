import re

def extract_all_styles():
    with open("dashboard_master.html", "r", encoding="utf-8") as f:
        content = f.read()

    # Find the style block
    style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if not style_match:
        print("No style block found")
        return
        
    styles = style_match.group(1)
    
    # We want to extract specific blocks
    # Let's search for patterns and output them
    
    sections = {
        "turnaround": r'(#iv-dashboard-app\s+)?([.#][\w-]*turnaround[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
        "headwind": r'(#iv-dashboard-app\s+)?([.#][\w-]*hw-[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
        "ranking": r'(#iv-dashboard-app\s+)?([.#][\w-]*ranking[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
        "monthly": r'(#iv-dashboard-app\s+)?([.#][\w-]*monthly[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
        "valuation": r'(#iv-dashboard-app\s+)?([.#][\w-]*valuation[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
        "portfolio": r'(#iv-dashboard-app\s+)?([.#][\w-]*portfolio[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
        "home": r'(#iv-dashboard-app\s+)?([.#][\w-]*home[\s\S]*?})(?=\s*(?:/\*|#iv-dashboard-app|$))',
    }
    
    # Actually, a simpler way is to just write a script that splits the styles by comments or scopes
    # Let's search styles using regex for each page prefix:
    for name, _ in sections.items():
        # Find all rules containing the name
        rules = []
        # Let's split CSS by '}' to process each rule block
        # (This is a naive CSS parser, but works well for this file)
        pos = 0
        while True:
            # find next '{' and matching '}'
            start_idx = styles.find('{', pos)
            if start_idx == -1:
                break
            end_idx = styles.find('}', start_idx)
            if end_idx == -1:
                break
            
            rule_selector = styles[pos:start_idx].strip()
            rule_body = styles[start_idx:end_idx+1].strip()
            
            # check if rule selector contains keywords related to the component
            match = False
            if name == "turnaround" and ("turnaround" in rule_selector):
                match = True
            elif name == "headwind" and ("headwind" in rule_selector or "hw-" in rule_selector):
                match = True
            elif name == "ranking" and ("ranking" in rule_selector):
                match = True
            elif name == "monthly" and ("monthly" in rule_selector or "market-bar" in rule_selector or "market-clock" in rule_selector or "market-needle" in rule_selector or "market-mini" in rule_selector or "market-status" in rule_selector or "market-message" in rule_selector):
                match = True
            elif name == "valuation" and ("valuation" in rule_selector):
                # avoid monthly analysis match
                if "monthly" not in rule_selector:
                    match = True
            elif name == "portfolio" and ("portfolio" in rule_selector):
                match = True
            elif name == "home" and ("home" in rule_selector or "micro-card" in rule_selector or "quick-tool" in rule_selector or "welcome-card" in rule_selector):
                match = True
                
            if match:
                # clean up selector: remove #iv-dashboard-app prefix, replace view-specific IDs
                cleaned_selector = rule_selector
                cleaned_selector = cleaned_selector.replace("#iv-dashboard-app", "")
                cleaned_selector = cleaned_selector.replace(f"#view-{name}", f".iv-{name}-page")
                if name == "monthly":
                    cleaned_selector = cleaned_selector.replace("#view-monthly-analysis", ".iv-monthly-analysis-page")
                    cleaned_selector = cleaned_selector.replace("#view-monthly", ".iv-monthly-dashboard-page")
                cleaned_selector = cleaned_selector.strip()
                rules.append(f"{cleaned_selector} {rule_body}")
                
            pos = end_idx + 1
            
        css_content = "\n\n".join(rules)
        out_path = f"scratch_{name}.css"
        with open(out_path, "w", encoding="utf-8") as out:
            out.write(css_content)
        print(f"Extracted {name} styles to {out_path} (length: {len(css_content)})")

if __name__ == "__main__":
    extract_all_styles()
