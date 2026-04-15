#!/bin/bash

# Data Gap Engine - Quick Test Suite
# Phase 2.2 Testing

set -e

BASE_URL="http://localhost:3001"
HOTEL_ID=16

echo "=========================================="
echo "Data Gap Engine - Test Suite"
echo "=========================================="
echo ""

# Test 1: Get hotel gaps with default limit
echo "Test 1: Get gaps with default limit (2)"
echo "GET /api/hotels/$HOTEL_ID/gaps"
curl -s "$BASE_URL/api/hotels/$HOTEL_ID/gaps" | jq '{gaps_count: (.gaps | length), coverage: .stats.coverage_percentage}'
echo ""

# Test 2: Get gaps with custom limit
echo "Test 2: Get gaps with custom limit (5)"
echo "GET /api/hotels/$HOTEL_ID/gaps?limit=5"
curl -s "$BASE_URL/api/hotels/$HOTEL_ID/gaps?limit=5" | jq '{gaps_count: (.gaps | length), gap_names: [.gaps[].category_name]}'
echo ""

# Test 3: Verify gap structure
echo "Test 3: Verify gap structure (first gap details)"
curl -s "$BASE_URL/api/hotels/$HOTEL_ID/gaps?limit=1" | jq '.gaps[0]'
echo ""

# Test 4: Check stats math
echo "Test 4: Verify stats calculations"
curl -s "$BASE_URL/api/hotels/$HOTEL_ID/gaps" | jq '{
  total: .stats.total_categories,
  mentioned: .stats.mentioned_categories,
  missing: .stats.missing_categories,
  math_check: (.stats.mentioned_categories + .stats.missing_categories == .stats.total_categories),
  coverage_pct: .stats.coverage_percentage
}'
echo ""

# Test 5: Test edge case - non-existent hotel
echo "Test 5: Non-existent hotel (should handle gracefully)"
curl -s "$BASE_URL/api/hotels/999999/gaps" | jq '{error: .error, stats: .stats}'
echo ""

# Test 6: Test edge case - zero/negative hotel ID
echo "Test 6: Invalid hotel ID"
curl -s "$BASE_URL/api/hotels/-1/gaps" | jq '{error: .error}'
echo ""

# Test 7: Compare multiple hotels
echo "Test 7: Compare hotels (get first 3 hotels)"
HOTELS=$(curl -s "$BASE_URL/api/hotels" | jq -r '.hotels[:3] | .[].id')
for hid in $HOTELS; do
  COVERAGE=$(curl -s "$BASE_URL/api/hotels/$hid/gaps" | jq '.stats.coverage_percentage')
  echo "  Hotel $hid: $COVERAGE% coverage"
done
echo ""

# Test 8: Test stale categories (if any exist)
echo "Test 8: Check for stale categories across all hotels"
FIRST_HOTEL=$(curl -s "$BASE_URL/api/hotels" | jq '.hotels[0].id')
STALE_COUNT=$(curl -s "$BASE_URL/api/hotels/$FIRST_HOTEL/gaps?limit=100" | jq '[.gaps[] | select(.gap_type == "stale")] | length')
echo "  Hotel $FIRST_HOTEL has $STALE_COUNT stale categories"
echo ""

echo "=========================================="
echo "✓ All tests completed!"
echo "=========================================="
