import glob

def cache_bust():
    files = glob.glob("frontend/pages/*.html")
    for f_path in files:
        with open(f_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Replace the navigation script tag with a cache-busted version
        updated = content.replace('src="../js/navigation.js"', 'src="../js/navigation.js?v=2"')
        
        with open(f_path, "w", encoding="utf-8") as f:
            f.write(updated)
    print(f"Updated {len(files)} HTML files with cache-busting.")

if __name__ == "__main__":
    cache_bust()
