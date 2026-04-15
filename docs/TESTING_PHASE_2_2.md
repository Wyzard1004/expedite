# Data Gap Engine - Comprehensive Test Plan

**Phase 2.2 Testing Documentation**

---

## Overview

The Data Gap Engine identifies categories (amenities) that hotels should be asked about. It detects:
- **MISSING**: Categories with zero reviews for a hotel
- **STALE**: Categories where last review is > 180 days old

This document covers unit tests, integration tests, edge cases, and abnormalities.

---

## 1. Unit Tests - Data Gap Logic

### Test 1.1: Find Missing Categories
**Objective**: Verify detection of categories with no reviews for a hotel

**Setup**:
- Hotel A has 50 reviews
- Total system categories: 727
- Hotel A's reviews mention: 88 categories
- Expected missing: 639 categories

**Test Case**:
```
GET /api/hotels/16/gaps?limit=5
Expected Response:
- gap_type: "missing"
- days_since_last_review: null
- last_review_date: null
- priority_score: > 1001 (highest priority)
```

**Validation**:
- ✓ Missing gaps have highest priority scores
- ✓ All returned gaps have gap_type === 'missing'
- ✓ No null reasons
- ✓ Exact count matches database (727 - mentioned)

---

### Test 1.2: Find Stale Categories
**Objective**: Verify detection of categories not reviewed recently

**Setup**:
- Create test scenario where a category was last mentioned 200 days ago
- STALE_THRESHOLD = 180 days
- Expected: Should be flagged as stale

**Test Case**:
```
Database Setup:
- Hotel B, Category "Gym"
- Last review mentioning "Gym": 200 days ago

Expected Response:
- gap_type: "stale"
- days_since_last_review: 200
- priority_score: ~6.67 (200/30)
- reason: "No recent reviews about Gym (last mentioned 200 days ago)"
```

**Validation**:
- ✓ days_since_last_review calculated correctly
- ✓ Only categories > 180 days old are flagged
- ✓ priority_score = days / 30 (correct math)
- ✓ last_review_date is present and valid

---

### Test 1.3: Fresh Categories (Not Stale)
**Objective**: Verify categories with recent reviews aren't flagged as stale

**Setup**:
- Category last mentioned 90 days ago (< 180 threshold)

**Test Case**:
```
GET /api/hotels/16/gaps

Expected Behavior:
- Category NOT in response gaps
- Should not flag as stale
```

**Validation**:
- ✓ Fresh categories (< 180 days) excluded from stale gaps
- ✓ Appear in mentioned_categories count

---

## 2. Integration Tests - API Endpoints

### Test 2.1: Hotel with Complete Data Coverage
**Objective**: Test hotel with high category coverage (minimal gaps)

**Setup**:
- Hotel with 100 reviews mentioning 200+ categories
- Expected gaps: small number

**Test Case**:
```bash
curl -s http://localhost:3001/api/hotels/16/gaps

Expected:
- gaps: array (small size, maybe 2-5 items)
- stats.coverage_percentage: high (e.g., 75%+)
- stats.missing_categories: (727 - mentioned)
```

**Validation**:
- ✓ Endpoint returns valid JSON
- ✓ All stats sum correctly
- ✓ Gaps sorted by priority_score descending
- ✓ Response time < 500ms

---

### Test 2.2: Hotel with Minimal Reviews
**Objective**: Test hotel with very few reviews

**Setup**:
- Find hotel with only 5 reviews
- Expected: Many missing categories

**Test Case**:
```bash
curl -s http://localhost:3001/api/hotels/[low-review-hotel-id]/gaps

Expected:
- gaps: 2 items (default limit)
- All gaps have gap_type: "missing"
- stats.coverage_percentage: very low (< 20%)
- stats.missing_categories: very high (> 700)
```

**Validation**:
- ✓ Works with hotels having few reviews
- ✓ Returns top missing categories
- ✓ Stats accurate for sparse data

---

### Test 2.3: Custom Limit Parameter
**Objective**: Verify limit parameter works correctly

**Test Cases**:
```bash
# Test limit=1
curl -s 'http://localhost:3001/api/hotels/16/gaps?limit=1'
Expected: gaps array length = 1

# Test limit=10 (max allowed)
curl -s 'http://localhost:3001/api/hotels/16/gaps?limit=10'
Expected: gaps array length ≤ 10

# Test limit=50 (exceeds max)
curl -s 'http://localhost:3001/api/hotels/16/gaps?limit=50'
Expected: gaps array length ≤ 10 (capped)

# Test limit=abc (invalid)
curl -s 'http://localhost:3001/api/hotels/16/gaps?limit=abc'
Expected: Uses default (2) or returns error
```

**Validation**:
- ✓ limit=1 returns 1 gap
- ✓ limit is capped at 10 (prevent abuse)
- ✓ Invalid limit falls back to default
- ✓ No crashes on bad input

---

## 3. Edge Cases & Abnormalities

### Edge Case 3.1: Non-Existent Hotel ID
**Test Case**:
```bash
curl -s http://localhost:3001/api/hotels/999999/gaps
```

**Expected Behavior**:
- Return stats with all zeros
- gaps: empty array
- No crash or 500 error
- Clear error message

**Validation**:
- ✓ Gracefully handle missing hotel
- ✓ Return 200 or 404 with error field

---

### Edge Case 3.2: Negative or Zero Hotel ID
**Test Case**:
```bash
curl -s http://localhost:3001/api/hotels/0/gaps
curl -s http://localhost:3001/api/hotels/-1/gaps
```

**Expected Behavior**:
- Reject as invalid
- Return 400 Bad Request
- Clear error message

**Validation**:
- ✓ Input validation catches invalid IDs
- ✓ 400 status code returned

---

### Edge Case 3.3: Hotel with Zero Reviews
**Objective**: Test anomaly where hotel exists but has no reviews

**Test Case**:
```
Database Setup:
- CREATE Hotel X with 0 reviews

GET /api/hotels/[X]/gaps

Expected:
- stats.mentioned_categories: 0
- stats.coverage_percentage: 0
- gaps: many (all 727 categories missing)
- All gaps sorted by priority
```

**Validation**:
- ✓ Handles gracefully
- ✓ All categories flagged as missing
- ✓ No division by zero errors

---

### Edge Case 3.4: Single Review Hotel
**Objective**: Test with minimal data

**Test Case**:
```
Database Setup:
- Hotel Y with 1 review mentioning 1 category

GET /api/hotels/[Y]/gaps

Expected:
- stats.mentioned_categories: 1
- stats.missing_categories: 726
- gaps: top 2 missing categories
- stats.coverage_percentage: 0% (rounded down)
```

**Validation**:
- ✓ Works with single data point
- ✓ Math is correct (1/727 ≈ 0%)
- ✓ Returns correct gap count

---

### Edge Case 3.5: All Categories Mentioned Recently
**Objective**: Test hotel with perfect data coverage

**Test Case**:
```
Database Setup:
- Hypothetical hotel mentioning all 727 categories
- All reviews within last 180 days

GET /api/hotels/[perfect-hotel]/gaps

Expected:
- stats.missing_categories: 0
- stats.coverage_percentage: 100
- gaps: empty array [] (no gaps)
- No stale flags
```

**Validation**:
- ✓ No false positives
- ✓ Returns empty gaps correctly
- ✓ Stats show 100% coverage

---

### Edge Case 3.6: Category Last Reviewed Exactly On Threshold
**Objective**: Test boundary condition (exactly 180 days)

**Test Case**:
```
Database Setup:
- Category last reviewed: exactly 180 days ago (midnight, same timezone)

GET /api/hotels/[hotel]/gaps

Expected Behavior:
- How do we handle exactly 180 days?
  Option A: Flag as NOT stale (>180, not >=180)
  Option B: Flag as stale (>=180)

Current Implementation: >180 (not stale)
```

**Validation**:
- ✓ Consistent boundary handling
- ✓ Document which option (>= vs >)
- ✓ Test with 180, 179, 181 days

---

## 4. Performance Tests

### Test 4.1: Response Time
**Objective**: Ensure acceptable latency

**Test Case**:
```bash
# Measure latency for hotel with many reviews
time curl -s http://localhost:3001/api/hotels/16/gaps

Expected: < 500ms (ideally < 200ms)
```

**Validation**:
- ✓ API responds quickly
- ✓ Database queries are efficient
- ✓ No N+1 query problems

---

### Test 4.2: Large Limit Requests
**Objective**: Ensure API handles bulk requests

**Test Cases**:
```bash
# Max allowed limit
curl -s 'http://localhost:3001/api/hotels/16/gaps?limit=10'
Expected Time: < 500ms

# Multiple rapid requests
for i in {1..10}; do
  curl -s 'http://localhost:3001/api/hotels/16/gaps'
done
Expected: All complete < 2 seconds total
```

**Validation**:
- ✓ Handles concurrent requests
- ✓ Database pool doesn't exhaust
- ✓ No connection timeouts

---

## 5. Data Anomalies & Corruption Tests

### Test 5.1: Missing Category with No Name
**Objective**: Handle malformed data

**Test Case**:
```
Database Anomaly:
- Category with NULL name or empty string

Expected Behavior:
- Should not crash
- Handle gracefully
- Return error or skip
```

**Validation**:
- ✓ Query handles NULL category names
- ✓ No rendering errors if returned

---

### Test 5.2: Review with Invalid Category ID
**Objective**: Handle referential integrity issues

**Test Case**:
```
Database Anomaly:
- review_categories row with invalid category_id

Expected Behavior:
- Query should still return results
- Invalid category skipped or flagged
```

**Validation**:
- ✓ LEFT JOINs handle missing categories
- ✓ Query doesn't fail

---

### Test 5.3: Duplicate Categories
**Objective**: Handle case sensitivity/duplicates

**Test Case**:
```
Database Anomaly:
- Categories "Wifi" and "wifi" (different case)
- Both exist with different IDs

Expected:
- Both treated as separate categories
- Both counted in stats
- May confuse users but won't crash
```

**Validation**:
- ✓ No crashes
- ✓ Document this limitation
- ✓ Consider data cleanup

---

## 6. Stats Validation Tests

### Test 6.1: Math Accuracy
**Objective**: Verify all stats calculations

**Test Case**:
```
For Hotel 16:
- Get actual counts from database
- Call /api/hotels/16/gaps
- Verify:
  stats.mentioned_categories = actual count
  stats.missing_categories = 727 - mentioned_categories
  stats.coverage_percentage = ROUND((mentioned/total) * 100)
```

**Validation**:
```sql
SELECT 
  (SELECT COUNT(DISTINCT rc.category_id) FROM review_categories rc 
   JOIN reviews r ON rc.review_id = r.id WHERE r.hotel_id = 16) as mentioned,
  (SELECT COUNT(*) FROM categories) as total
```

---

### Test 6.2: Stale Categories Count Accuracy
**Objective**: Verify stale count in stats

**Test Case**:
```sql
-- Count stale categories manually
SELECT COUNT(DISTINCT rc.category_id)
FROM review_categories rc
JOIN reviews r ON rc.review_id = r.id
WHERE r.hotel_id = 16
AND rc.category_id IN (
  SELECT c.id FROM categories c
  WHERE (NOW() - MAX(r.created_at) INTERVAL) > 180 days
)
-- Compare with stats.stale_categories
```

**Validation**:
- ✓ Manual count matches API result
- ✓ Stats math is correct

---

## 7. Real-World Scenarios

### Scenario 7.1: Guest Review Workflow
**Objective**: Simulate actual usage

**Steps**:
1. Guest opens hotel page for Hotel 16
2. System calls `/api/hotels/16` (get reviews)
3. System calls `/api/hotels/16/gaps` (get suggestions)
4. UI suggests top 2 gaps to guest
5. Guest sees: "Tell us about the [Gap1] and [Gap2]!"

**Expected Outcome**:
- Gaps are relevant and compelling
- Gap descriptions are clear
- Suggestions don't repeat

---

### Scenario 7.2: Admin Dashboard
**Objective**: Monitor data quality

**Steps**:
1. Admin loads dashboard
2. Fetches all hotels' gap stats
3. Shows: coverage % per hotel
4. Highlights hotels with <30% coverage

**Expected Outcome**:
- All stats load quickly
- No timeout/crash for 18 hotels
- Stats are actionable

---

## 8. Test Execution Checklist

- [ ] Test 1.1: Find missing categories
- [ ] Test 1.2: Find stale categories  
- [ ] Test 1.3: Fresh categories not stale
- [ ] Test 2.1: Complete data coverage hotel
- [ ] Test 2.2: Minimal reviews hotel
- [ ] Test 2.3: Custom limit parameter
- [ ] Edge Case 3.1: Non-existent hotel
- [ ] Edge Case 3.2: Invalid hotel ID
- [ ] Edge Case 3.3: Hotel with zero reviews
- [ ] Edge Case 3.4: Single review hotel
- [ ] Edge Case 3.5: Perfect coverage hotel
- [ ] Edge Case 3.6: Boundary 180-day threshold
- [ ] Test 4.1: Response time
- [ ] Test 4.2: Large limit requests
- [ ] Test 5.1: Missing category name
- [ ] Test 5.2: Invalid category ID
- [ ] Test 5.3: Duplicate categories
- [ ] Test 6.1: Stats math accuracy
- [ ] Test 6.2: Stale count accuracy
- [ ] Scenario 7.1: Guest workflow
- [ ] Scenario 7.2: Admin dashboard

---

## 9. Known Issues & Limitations

1. **Boundary Cases**: Exactly 180-day threshold uses > not >=
2. **Case Sensitivity**: "Wifi" and "wifi" treated as different categories
3. **Timezone**: Uses server time, not UTC explicitly
4. **Performance**: O(n) for all categories per request
5. **Future**: Consider caching stats for frequently-accessed hotels

---

## 10. Next Steps

- [ ] Implement automated test suite
- [ ] Set up performance benchmarks
- [ ] Monitor API metrics in production
- [ ] Review logs for abnormal gap detection
- [ ] Iterate on gap prioritization algorithm
