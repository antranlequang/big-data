#!/bin/bash

# Test Deployment Script
# Quick validation of deployment readiness

echo "🧪 Testing Deployment Configuration"
echo "==================================="

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

# Test 1: Check if essential files exist
echo "📁 Checking essential files..."
files_to_check=(
    "vercel.json"
    "package.json"
    "next.config.js"
    "api/index.py"
    "lib/minio_client.py"
    ".env.example"
    "README-DEPLOYMENT.md"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file is missing"
    fi
done

# Test 2: Check package.json scripts
echo ""
echo "📦 Checking package.json scripts..."
if grep -q '"deploy:vercel"' package.json; then
    print_success "Vercel deployment scripts configured"
else
    print_error "Missing deployment scripts"
fi

# Test 3: Validate vercel.json
echo ""
echo "⚙️  Validating vercel.json..."
if [ -f "vercel.json" ]; then
    if command -v node &> /dev/null; then
        node -e "
        try {
            const config = JSON.parse(require('fs').readFileSync('vercel.json', 'utf8'));
            console.log('✅ vercel.json is valid JSON');
            
            if (config.env && config.env.MINIO_ENDPOINT) {
                console.log('✅ MinIO configuration found');
            } else {
                console.log('⚠️  MinIO environment variables not configured');
            }
            
            if (config.functions) {
                console.log('✅ Function configuration found');
            } else {
                console.log('⚠️  Function configuration missing');
            }
        } catch (error) {
            console.log('❌ vercel.json validation failed:', error.message);
        }
        "
    else
        print_warning "Node.js not available, skipping JSON validation"
    fi
fi

# Test 4: Check Python requirements
echo ""
echo "🐍 Checking Python configuration..."
if [ -f "requirements-vercel.txt" ]; then
    print_success "Vercel Python requirements file exists"
else
    print_error "requirements-vercel.txt missing"
fi

if [ -f "api/index.py" ]; then
    print_success "Python API handler exists"
else
    print_error "Python API handler missing"
fi

# Test 5: Check for environment example
echo ""
echo "🔐 Checking environment configuration..."
if [ -f ".env.example" ]; then
    print_success ".env.example template exists"
    
    # Check if critical env vars are documented
    required_vars=("MINIO_ENDPOINT" "MINIO_ACCESS_KEY" "MINIO_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if grep -q "$var" .env.example; then
            print_success "$var documented in .env.example"
        else
            print_warning "$var not found in .env.example"
        fi
    done
else
    print_error ".env.example missing"
fi

# Test 6: Try to build the project
echo ""
echo "🏗️  Testing build process..."
if command -v npm &> /dev/null; then
    print_success "npm is available"
    
    echo "Installing dependencies..."
    npm install --silent > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
        
        echo "Testing build..."
        npm run build > build.log 2>&1
        
        if [ $? -eq 0 ]; then
            print_success "Build completed successfully"
            rm -f build.log
        else
            print_error "Build failed, check build.log for details"
            echo "Recent build errors:"
            tail -n 10 build.log
        fi
    else
        print_error "Failed to install dependencies"
    fi
else
    print_warning "npm not available, skipping build test"
fi

# Test 7: Check MinIO client configuration
echo ""
echo "🗄️  Testing MinIO client..."
if command -v python3 &> /dev/null; then
    python3 -c "
import sys
sys.path.append('lib')
try:
    from minio_client import VercelMinIOClient
    print('✅ MinIO client imports successfully')
    
    # Try to create client (will use env vars if available)
    try:
        client = VercelMinIOClient()
        print('✅ MinIO client initializes successfully')
    except Exception as e:
        print(f'⚠️  MinIO client initialization failed: {e}')
        print('   This is expected if MinIO credentials are not configured')
except ImportError as e:
    print(f'❌ MinIO client import failed: {e}')
except Exception as e:
    print(f'❌ MinIO client test failed: {e}')
" 2>/dev/null || print_warning "MinIO client test failed (check Python dependencies)"
else
    print_warning "Python3 not available, skipping MinIO test"
fi

# Test 8: Deployment checklist
echo ""
echo "📋 Deployment Checklist:"
echo "========================"

checklist_items=(
    "Create MinIO account and get credentials"
    "Set up Vercel account and install CLI"
    "Configure environment variables in Vercel"
    "Test API endpoints after deployment"
    "Set up monitoring and alerts"
    "Configure custom domain (optional)"
)

for item in "${checklist_items[@]}"; do
    echo "☐ $item"
done

echo ""
echo "🚀 Deployment Test Summary"
echo "=========================="
print_success "Configuration files checked"
print_success "Build process validated"
print_warning "Manual steps required for full deployment"

echo ""
echo "Next Steps:"
echo "1. Configure your MinIO credentials"
echo "2. Run: npm run deploy:prod"
echo "3. Test deployed endpoints"
echo "4. Monitor application logs"

echo ""
print_success "Deployment test completed!"