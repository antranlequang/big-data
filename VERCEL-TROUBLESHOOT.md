# 🔧 Vercel Deployment Troubleshooting Guide

## ✅ **FIXED: Module Resolution Error**

### **Problem**
```
Module not found: Can't resolve '@/components/RealTimePriceChart'
```

### **Solution Applied**
1. **Switched to relative imports** in `app/page.tsx`
2. **Added prebuild script** to automatically fix import paths
3. **Created import validation** in the build process

### **Files Modified**
- ✅ `app/page.tsx` - Changed to relative imports
- ✅ `package.json` - Added prebuild script
- ✅ `scripts/fix-imports.js` - Automatic import fixer
- ✅ `.gitattributes` - Consistent file handling

---

## 🚀 **Quick Fix Commands**

```bash
# If you encounter import errors again
npm run prebuild

# Manual fix for any component import issues
node scripts/fix-imports.js

# Test build locally before deploying
npm run build

# Deploy with validated configuration
npm run deploy:prod
```

---

## 🔍 **Common Vercel Build Issues & Solutions**

### **1. Module Resolution Issues**

**Problem:** `Module not found: Can't resolve '@/components/ComponentName'`

**Solution:**
```bash
# Use relative imports instead of absolute
# From: import Component from '@/components/Component'  
# To:   import Component from '../components/Component'
```

**Auto-fix:**
```bash
npm run prebuild  # Runs automatically before build
```

### **2. Case Sensitivity Issues**

**Problem:** Works locally but fails on Vercel (Linux filesystem)

**Solution:**
```bash
# Ensure exact filename matching
ls -la components/  # Check actual filenames
```

### **3. TypeScript Path Mapping Issues**

**Problem:** `tsconfig.json` paths not working on Vercel

**Solution:**
```bash
# Add explicit path mapping in next.config.js
# Or use relative imports (already implemented)
```

### **4. Environment Variable Issues**

**Problem:** MinIO connection fails, API keys missing

**Solution:**
```bash
# Set in Vercel dashboard:
# - MINIO_ENDPOINT
# - MINIO_ACCESS_KEY  
# - MINIO_SECRET_KEY
# - MINIO_USE_SSL=true
```

### **5. Function Timeout Issues**

**Problem:** API routes timeout during deployment/runtime

**Solution:**
```json
// Already configured in vercel.json
{
  "functions": {
    "app/api/*/route.ts": {
      "maxDuration": 30
    }
  }
}
```

---

## 🏗️ **Build Process Validation**

### **Pre-deployment Checklist**
```bash
# 1. Validate all imports
npm run prebuild

# 2. Test local build
npm run build

# 3. Check for sensitive files
npm run git:validate

# 4. Test deployment config
./scripts/test-deployment.sh
```

### **Environment Validation**
```bash
# Check Vercel environment variables
vercel env ls

# Test MinIO connection
npm run test:minio

# Validate git configuration
npm run git:validate
```

---

## 🐛 **Debug Commands**

### **Local Development**
```bash
# Start development server
npm run dev

# Build locally with debug
npm run build 2>&1 | tee build.log

# Check component exports
node -e "console.log(require('./components/RealTimePriceChart.tsx'))"
```

### **Production Debugging**
```bash
# Check Vercel logs
vercel logs --follow

# Test API endpoints
curl https://your-domain.vercel.app/api/health
curl https://your-domain.vercel.app/api/crypto?coinId=bitcoin

# Monitor function performance
vercel logs --since=10m
```

---

## 📋 **Vercel Configuration Summary**

### **Current Setup**
- ✅ **Runtime:** `nodejs` for API routes
- ✅ **Dynamic routes:** `force-dynamic` enabled
- ✅ **Function timeout:** 30 seconds
- ✅ **Environment variables:** Configured via dashboard
- ✅ **Import resolution:** Relative imports
- ✅ **Build optimization:** Prebuild script

### **Deployment Files**
```
├── vercel.json           # Main Vercel configuration
├── next.config.js        # Next.js settings
├── .vercelignore         # Files to exclude from deployment
├── .gitignore           # Files to exclude from git
├── package.json         # Scripts and dependencies
└── scripts/
    ├── deploy.sh        # Automated deployment
    ├── fix-imports.js   # Import path fixer
    └── test-deployment.sh # Pre-deployment validation
```

---

## 🎯 **Performance Optimization**

### **Current Optimizations**
- ✅ **Bundle analysis** in build output
- ✅ **Webpack optimization** via Next.js
- ✅ **API route caching** where appropriate
- ✅ **Static generation** for static pages
- ✅ **Component lazy loading** via dynamic imports

### **Production Recommendations**
```bash
# Monitor bundle size
npm run build | grep "First Load JS"

# Optimize images (if any)
# Use next/image for automatic optimization

# Enable compression
# Already handled by Vercel CDN
```

---

## 🔧 **Advanced Troubleshooting**

### **If Build Still Fails**

1. **Check exact error message**
   ```bash
   vercel logs --follow
   ```

2. **Verify file existence**
   ```bash
   ls -la components/RealTimePriceChart.tsx
   ```

3. **Test with minimal imports**
   ```tsx
   // Temporarily comment out problematic imports
   // import RealTimePriceChart from '../components/RealTimePriceChart'
   ```

4. **Use dynamic imports as fallback**
   ```tsx
   const RealTimePriceChart = dynamic(() => import('../components/RealTimePriceChart'))
   ```

### **Nuclear Option: Reset and Redeploy**
```bash
# 1. Clean all builds
rm -rf .next node_modules

# 2. Reinstall dependencies
npm install

# 3. Test build locally
npm run build

# 4. Force new deployment
vercel --force --prod
```

---

## ✅ **Success Indicators**

### **Successful Build Shows:**
```
✓ Compiled successfully
✓ Generating static pages (7/7)
✓ Collecting build traces
```

### **Successful Deployment Shows:**
```
✅ Ready! Available at https://your-domain.vercel.app
```

### **API Health Check:**
```bash
curl https://your-domain.vercel.app/api/health
# Should return: {"status":"healthy"}
```

---

## 📞 **Get Help**

### **Error Logs**
```bash
# Local build issues
npm run build 2>&1 | tee build-error.log

# Vercel deployment issues  
vercel logs --follow > deployment-error.log
```

### **Support Channels**
- [Vercel Discord](https://discord.gg/vercel)
- [Next.js GitHub Issues](https://github.com/vercel/next.js/issues)
- [Project GitHub Issues](https://github.com/yourusername/crypto-dashboard/issues)

---

## 🎉 **Your deployment is now fixed and ready!**

The import resolution issue has been resolved with:
- ✅ Relative imports in `app/page.tsx`
- ✅ Automated prebuild script
- ✅ Comprehensive error prevention

**Deploy with confidence!** 🚀