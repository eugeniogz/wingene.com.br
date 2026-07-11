#!/bin/bash

# Define directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DOCS_DIR="$SCRIPT_DIR/docs"
SITEMAP_FILE="$DOCS_DIR/sitemap.xml"
BASE_URL="https://wingene.com.br"

# Check if docs directory exists
if [ ! -d "$DOCS_DIR" ]; then
  echo "Error: docs directory not found at $DOCS_DIR"
  exit 1
fi

echo "Generating sitemap.xml..."

# Start writing to the temporary sitemap file
TEMP_SITEMAP=$(mktemp)

cat <<EOF > "$TEMP_SITEMAP"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
EOF

# Find all .html files in DOCS_DIR
# Sort them to keep the order in sitemap.xml deterministic
find "$DOCS_DIR" -type f -name "*.html" | sort | while read -r file; do
  # Get path relative to DOCS_DIR
  rel_path="${file#$DOCS_DIR/}"
  
  # Determine URL, Priority and Change Frequency
  if [ "$rel_path" = "index.html" ]; then
    url="$BASE_URL/"
    priority="1.0"
    changefreq="weekly"
  elif [[ "$rel_path" =~ /index\.html$ ]]; then
    dir_path="${rel_path%/index.html}"
    url="$BASE_URL/$dir_path/"
    priority="0.8"
    changefreq="weekly"
  else
    url="$BASE_URL/$rel_path"
    priority="0.6"
    changefreq="monthly"
  fi
  
  # Get last modification date (format: YYYY-MM-DD)
  # Uses stat -c %Y on Linux or stat -f %m on macOS
  if stat --help 2>&1 | grep -q 'GNU'; then
    # GNU/Linux stat
    lastmod=$(date -d "@$(stat -c %Y "$file")" +%Y-%m-%d)
  else
    # BSD/macOS stat
    lastmod=$(date -r "$(stat -f %m "$file")" +%Y-%m-%d)
  fi

  cat <<EOF >> "$TEMP_SITEMAP"
  <url>
    <loc>$url</loc>
    <lastmod>$lastmod</lastmod>
    <changefreq>$changefreq</changefreq>
    <priority>$priority</priority>
  </url>
EOF
done

cat <<EOF >> "$TEMP_SITEMAP"
</urlset>
EOF

# Move temp file to actual sitemap.xml path
mv "$TEMP_SITEMAP" "$SITEMAP_FILE"
chmod 644 "$SITEMAP_FILE"

echo "Sitemap generated successfully at $SITEMAP_FILE"
