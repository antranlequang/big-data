#!/bin/bash

# Repository Cleanup Script
# Removes large files and ensures proper .gitignore

echo "🧹 Cleaning up repository for GitHub upload..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Remove large temporary files
echo "🗑️  Removing temporary and cache files..."

# Remove Next.js cache
if [ -d ".next/cache" ]; then
    rm -rf .next/cache
    print_success "Removed Next.js cache"
fi

# Remove log files
find . -name "*.log" -not -path "./.git/*" -delete
print_success "Removed log files"

# Remove temporary Python files
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
print_success "Removed Python cache files"

# Remove any CSV data files that might be large
find data -name "*.csv" -size +100k -delete 2>/dev/null
print_success "Removed large CSV files from data directory"

# Remove any JSON data files that might be large
find data -name "*.json" -size +100k -not -name "*metadata*" -delete 2>/dev/null
print_success "Removed large JSON files from data directory"

# Remove npm debug logs
rm -f npm-debug.log*
rm -f yarn-error.log*
print_success "Removed npm debug logs"

# Clean up any backup files
find . -name "*.bak" -delete
find . -name "*~" -delete
find . -name "*.backup" -delete
print_success "Removed backup files"

# Remove any .DS_Store files
find . -name ".DS_Store" -delete 2>/dev/null
print_success "Removed .DS_Store files"

echo ""
echo "📊 Repository size analysis:"

# Check current repository size
echo "Current directory size:"
du -sh . | grep -v node_modules | grep -v venv | grep -v .venv

echo ""
echo "Largest remaining files (excluding ignored directories):"
find . -type f -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.venv/*" -not -path "./.next/*" -not -path "./.git/*" -exec du -h {} \; | sort -hr | head -10

echo ""
echo "Files that will be committed to git:"
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Total tracked files size:"
    git ls-files | xargs du -ch 2>/dev/null | tail -1
else
    print_warning "Git not initialized"
fi

echo ""
echo "🔍 Checking for any remaining large files..."

# Check for files larger than 50MB
LARGE_FILES=$(find . -type f -size +50M -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./.venv/*" -not -path "./.next/*" 2>/dev/null)

if [ -n "$LARGE_FILES" ]; then
    print_error "Large files found that should be excluded:"
    echo "$LARGE_FILES" | while read file; do
        echo "  $(du -h "$file")"
    done
    echo ""
    print_warning "Add these patterns to .gitignore if needed"
else
    print_success "No large files found outside of ignored directories"
fi

echo ""
echo "✨ Repository cleanup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Commit your changes: git add . && git commit -m 'Clean up repository'"
echo "2. Push to GitHub: git push origin main"
echo "3. If still having issues, check GitHub's upload method"