#!/bin/bash

# Crypto Dashboard Deployment Script
# Automated deployment to Vercel with MinIO setup

set -e  # Exit on any error

echo "🚀 Starting Crypto Dashboard Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="crypto-dashboard"
VERCEL_ORG=""  # Set your Vercel org if needed

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    if ! command -v python3 &> /dev/null; then
        print_warning "Python 3 not found. Some features may not work locally."
    fi
    
    print_success "Dependencies checked!"
}

# Install project dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    npm install
    print_success "Dependencies installed!"
}

# Build and test the project
build_project() {
    print_status "Building project..."
    npm run build
    print_success "Build completed!"
}

# Test MinIO connection (if credentials provided)
test_minio() {
    if [ -f ".env.local" ]; then
        print_status "Testing MinIO connection..."
        
        # Check if Python and required packages are available
        if command -v python3 &> /dev/null; then
            python3 -c "
import sys
sys.path.append('lib')
try:
    from minio_client import VercelMinIOClient
    client = VercelMinIOClient()
    print('✅ MinIO connection test passed!')
except Exception as e:
    print(f'❌ MinIO connection test failed: {e}')
    print('Please check your MinIO credentials in .env.local')
" || print_warning "MinIO test failed. Please check your credentials."
        else
            print_warning "Python not available. Skipping MinIO test."
        fi
    else
        print_warning ".env.local not found. Skipping MinIO test."
    fi
}

# Deploy to Vercel
deploy_to_vercel() {
    print_status "Deploying to Vercel..."
    
    # Check if user is logged in
    if ! vercel whoami &> /dev/null; then
        print_status "Logging in to Vercel..."
        vercel login
    fi
    
    # Deploy
    if [ "$1" = "production" ]; then
        print_status "Deploying to production..."
        vercel --prod
    else
        print_status "Deploying to preview..."
        vercel
    fi
    
    print_success "Deployment completed!"
}

# Set up environment variables
setup_env_vars() {
    print_status "Setting up environment variables..."
    
    if [ -f ".env.local" ]; then
        print_status "Found .env.local file. Setting up Vercel environment variables..."
        
        # Read .env.local and set Vercel environment variables
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z "$key" ]] && continue
            
            # Remove quotes from value if present
            value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/')
            
            print_status "Setting $key for production environment..."
            echo "$value" | vercel env add "$key" production --force || print_warning "Failed to set $key"
            
        done < .env.local
        
        print_success "Environment variables configured!"
    else
        print_warning ".env.local not found. Please set environment variables manually in Vercel dashboard."
        print_status "Required variables:"
        echo "  - MINIO_ENDPOINT"
        echo "  - MINIO_ACCESS_KEY"
        echo "  - MINIO_SECRET_KEY"
        echo "  - MINIO_USE_SSL"
        echo "  - MINIO_BUCKET"
    fi
}

# Initialize data pipeline
init_data_pipeline() {
    print_status "Initializing data pipeline..."
    
    # Get deployment URL
    DEPLOYMENT_URL=$(vercel ls | grep "$PROJECT_NAME" | head -1 | awk '{print $2}')
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        print_warning "Could not determine deployment URL. Please run data pipeline manually:"
        echo "  curl -X POST https://your-domain.vercel.app/api/collect-data"
        echo "  curl -X POST https://your-domain.vercel.app/api/data-pipeline"
        return
    fi
    
    print_status "Testing deployment at https://$DEPLOYMENT_URL"
    
    # Test health endpoint
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DEPLOYMENT_URL/api/health" || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Deployment is healthy!"
        
        # Initialize data collection
        print_status "Starting initial data collection..."
        curl -X POST "https://$DEPLOYMENT_URL/api/collect-data" || print_warning "Data collection failed"
        
        # Run data pipeline
        print_status "Running data pipeline..."
        curl -X POST "https://$DEPLOYMENT_URL/api/data-pipeline" || print_warning "Data pipeline failed"
        
        print_success "Data pipeline initialized!"
    else
        print_warning "Deployment health check failed (HTTP $HTTP_STATUS)"
        print_status "Please check your deployment manually at https://$DEPLOYMENT_URL"
    fi
}

# Main deployment function
main() {
    echo "🚀 Crypto Dashboard Deployment Script"
    echo "======================================"
    
    # Parse command line arguments
    ENVIRONMENT="preview"
    SKIP_TESTS=false
    SKIP_INIT=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --prod|--production)
                ENVIRONMENT="production"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-init)
                SKIP_INIT=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --prod, --production  Deploy to production environment"
                echo "  --skip-tests         Skip test execution"
                echo "  --skip-init          Skip data pipeline initialization"
                echo "  -h, --help           Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_status "Deployment mode: $ENVIRONMENT"
    
    # Run deployment steps
    check_dependencies
    install_dependencies
    
    if [ "$SKIP_TESTS" = false ]; then
        build_project
        test_minio
    else
        print_warning "Skipping tests as requested"
    fi
    
    setup_env_vars
    deploy_to_vercel "$ENVIRONMENT"
    
    if [ "$SKIP_INIT" = false ] && [ "$ENVIRONMENT" = "production" ]; then
        init_data_pipeline
    else
        print_warning "Skipping data pipeline initialization"
    fi
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Visit your Vercel dashboard to monitor the deployment"
    echo "2. Check the application logs for any issues"
    echo "3. Verify MinIO data storage is working"
    echo "4. Set up monitoring and alerts"
    echo ""
    print_status "Useful commands:"
    echo "  vercel logs --follow    # Follow deployment logs"
    echo "  vercel env ls          # List environment variables"
    echo "  vercel domains         # Manage custom domains"
    echo ""
}

# Run main function with all arguments
main "$@"