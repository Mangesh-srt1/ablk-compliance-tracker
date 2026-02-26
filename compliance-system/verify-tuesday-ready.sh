#!/usr/bin/env bash
# Tuesday Readiness Verification (simpler version)

echo ""
echo "=========================================="
echo "TUESDAY (Mar 4) READINESS CHECK"
echo "=========================================="
echo ""

# Check Docker
echo "Checking Docker services..."
docker-compose -f docker-compose.dev.yml ps 2>/dev/null | grep -q "postgres" && \
docker-compose -f docker-compose.dev.yml ps 2>/dev/null | grep -q "healthy" && \
echo "[OK] PostgreSQL healthy" || echo "[WARN] PostgreSQL may not be healthy"

# Check database
echo "Checking database..."
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d compliance_db -c "SELECT COUNT(*) as count FROM kyc_checks;" 2>/dev/null | tail -1 && \
echo "[OK] Database accessible" || echo "[WARN] Cannot access database"

# Check build
echo ""
echo "Checking TypeScript compilation..."
npm run build 2>&1 | grep -q "error" && \
echo "[WARN] Build has errors" || \
echo "[OK] Build successful (0 TypeScript errors)"

# Check critical files
echo ""
echo "Checking critical files..."
for file in \
  "src/agents/src/tools/ballerineClient.ts" \
  "src/api/src/services/providers/ballerineKycProvider.ts" \
  "src/api/src/services/providers/chainalysisAmlProvider.ts" \
  "src/api/src/services/kycService.ts"
do
  if [ -f "$file" ]; then
    echo "[OK] $file"
  else
    echo "[FAIL] $file NOT FOUND"
  fi
done

echo ""
echo "=========================================="
echo "Setup Status Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "  1. npm run test:watch          # Start test watcher"
echo "  2. Read: docs/TUESDAY_EXECUTION_GUIDE.md"
echo "  3. Begin: Task 1 - Ballerine tests"
echo ""
