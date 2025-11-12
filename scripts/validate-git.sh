#!/bin/bash

# Git Validation Script
# Ensures no sensitive files are committed before pushing to GitHub

echo "🔍 Git Commit Validation"
echo "========================"

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

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
fi

# Check for sensitive files that might be accidentally included
echo "🔒 Checking for sensitive files..."

# Define patterns for sensitive files
SENSITIVE_PATTERNS=(
    "*.env"
    "*.env.*"
    "*.key"
    "*.pem"
    ".env.local"
    "config/secrets.json"
    "api_credentials.json"
    "wallet.json"
    "private_keys.json"
)

# Check if any sensitive files would be committed
SENSITIVE_FOUND=false
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git add -n . 2>/dev/null | grep -q "$pattern"; then
        print_error "Sensitive file pattern '$pattern' would be committed!"
        SENSITIVE_FOUND=true
    fi
done

if [ "$SENSITIVE_FOUND" = false ]; then
    print_success "No sensitive file patterns detected"
fi

# Check for large data files
echo ""
echo "📁 Checking for large data files..."

LARGE_FILES=$(find . -type f -size +10M -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./venv/*" 2>/dev/null)

if [ -n "$LARGE_FILES" ]; then
    print_warning "Large files found (>10MB):"
    echo "$LARGE_FILES"
    echo "Consider using Git LFS or excluding these files"
else
    print_success "No large files detected"
fi

# Check for environment files
echo ""
echo "🌍 Checking environment configuration..."

if [ -f ".env" ]; then
    print_error ".env file exists - this should not be committed!"
    echo "   Rename to .env.local or add to .gitignore"
else
    print_success "No .env file in root directory"
fi

if [ -f ".env.example" ]; then
    print_success ".env.example exists for documentation"
else
    print_warning ".env.example missing - consider creating one"
fi

# Check gitignore effectiveness
echo ""
echo "🚫 Testing .gitignore effectiveness..."

# Count files that would be committed
TOTAL_FILES=$(git add -n . 2>/dev/null | wc -l)
echo "Files that would be committed: $TOTAL_FILES"

# Check specific file types
LOG_FILES=$(git add -n . 2>/dev/null | grep "\.log" | wc -l)
CSV_FILES=$(git add -n . 2>/dev/null | grep "\.csv" | wc -l)
JSON_DATA_FILES=$(git add -n . 2>/dev/null | grep -E "data/.*\.json" | grep -v "data_metadata.json" | wc -l)

if [ "$LOG_FILES" -eq 0 ]; then
    print_success "Log files properly ignored"
else
    print_error "$LOG_FILES log files would be committed"
fi

if [ "$CSV_FILES" -eq 0 ]; then
    print_success "CSV data files properly ignored"
else
    print_error "$CSV_FILES CSV files would be committed"
fi

if [ "$JSON_DATA_FILES" -eq 0 ]; then
    print_success "JSON data files properly ignored (except metadata)"
else
    print_error "$JSON_DATA_FILES JSON data files would be committed"
fi

# Check for Python cache files
echo ""
echo "🐍 Checking Python cache files..."

PYCACHE_FILES=$(find . -name "__pycache__" -type d -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null)
PYC_FILES=$(find . -name "*.pyc" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null)

if [ -z "$PYCACHE_FILES" ] && [ -z "$PYC_FILES" ]; then
    print_success "No Python cache files found"
else
    print_warning "Python cache files exist but should be ignored by git"
fi

# Check for Node.js files
echo ""
echo "📦 Checking Node.js files..."

if [ -d "node_modules" ]; then
    if git add -n . 2>/dev/null | grep -q "node_modules/"; then
        print_error "node_modules would be committed!"
    else
        print_success "node_modules properly ignored"
    fi
else
    print_warning "node_modules not found - run 'npm install' if needed"
fi

# Summary and recommendations
echo ""
echo "📋 Summary & Recommendations"
echo "============================"

if [ "$SENSITIVE_FOUND" = true ]; then
    print_error "CRITICAL: Sensitive files detected!"
    echo "   Do not push until these are resolved"
    echo "   Check your .gitignore and remove sensitive files"
    exit 1
fi

echo "Safe to proceed with git operations:"
echo ""
echo "📤 Ready to push to GitHub:"
echo "  git add ."
echo "  git commit -m 'Initial crypto dashboard setup'"
echo "  git branch -M main"
echo "  git remote add origin https://github.com/yourusername/crypto-dashboard.git"
echo "  git push -u origin main"

print_success "Git validation completed!"

echo ""
echo "🔐 Security Reminders:"
echo "• Never commit .env files"
echo "• Keep API keys in Vercel environment variables"
echo "• Use MinIO for data storage, not git"
echo "• Regularly review committed files"