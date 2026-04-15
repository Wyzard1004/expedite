# Phase 2.3 Testing Plan: Hotel Page UI

## Overview
This document provides comprehensive testing strategy for Phase 2.3 UI implementation, covering the hotel listing page and individual hotel detail pages with amenities display, data gaps suggestions, and review button.

## Test Scope

### Pages Under Test
1. **HotelsPage** (`app/hotels/page.tsx`) - Hotel listing/discovery
2. **HotelPage** (`app/hotels/[id]/page.tsx`) - Hotel details with amenities and gaps

### Features to Test
- Loading states and skeleton UI
- Data fetching and error handling
- Hotel list rendering (18 hotels)
- Hotel detail rendering (name, location, description)
- Amenities display (grid layout with all categories)
- Data gaps rendering (top 2 gaps with suggestions)
- Recent reviews display (first 3, expandable to all)
- Review modal (mock for Phase 2.3)
- Navigation between pages
- Responsive design (mobile, tablet, desktop)

---

## Unit Tests

### 1. Component Rendering
**Description:** Verify components render without crashing

#### Test 1.1: HotelsPage renders with mock data
```
Given: Mock fetch returns 18 hotels
When: Component mounts
Then: All 18 hotel cards visible
And: Each card has name, location, review count
```

#### Test 1.2: HotelPage renders hotel details
```
Given: Hotel ID = 16, API returns hotel data
When: Component mounts
Then: Hotel name "Hotel Venice" displayed
And: Location "Venice, Italy" displayed
And: Description visible
```

#### Test 1.3: Amenities grid displays all categories
```
Given: Hotel 16 with 88 categories
When: HotelPage renders
Then: All 88 categories displayed in 4-column grid
And: Each has "✓" prefix
And: Checkmark icons visible
```

#### Test 1.4: Data gaps section shows top 2
```
Given: Hotel 16 with gaps available
When: HotelPage renders
Then: "Help Us Learn More!" section visible
And: Exactly 2 gaps displayed
And: Gap names shown clearly
And: Light blue background with left border
```

#### Test 1.5: Recent reviews display up to 3
```
Given: Hotel 16 with 50 reviews
When: HotelPage renders
Then: First 3 reviews displayed
And: Guest name, date, content visible
And: Categories shown as tags
And: "+X more" indicator for extra categories
And: "View all 50 reviews →" link visible
```

---

## Integration Tests

### 2. Data Fetching

#### Test 2.1: HotelsPage fetches from /api/hotels
```
Given: Component mounts
When: useEffect triggers
Then: GET /api/hotels called once
And: Loading state true initially
And: Loading state false after response
And: Hotels state populated
```

#### Test 2.2: HotelPage fetches hotel and gaps data
```
Given: Hotel ID extracted from params
When: hotelId state updates
Then: GET /api/hotels/16 called
And: GET /api/hotels/16/gaps?limit=2 called
And: Both requests complete within 5 seconds
And: Data populated without errors
```

#### Test 2.3: Params are correctly unwrapped from Promise
```
Given: params as Promise<{id: string}>
When: useEffect runs
Then: Promise awaited properly
And: hotelId state is number (not string with await)
And: API calls use correct numeric ID
```

#### Test 2.4: Data updates trigger re-renders
```
Given: Hotel data fetched
When: Categories state updates
Then: Amenities grid re-renders
And: New category count displayed
And: No duplicate renders
```

---

## Loading & Error States

### 3. Loading States

#### Test 3.1: HotelsPage shows skeleton while loading
```
Given: Component mounting
When: Before API response
Then: Skeleton cards visible (4 placeholder divs)
And: "animate-pulse" class applied
And: No actual hotel data visible
```

#### Test 3.2: HotelPage shows skeleton loading
```
Given: Component mounting
When: Before API response
Then: Top-level skeleton visible
And: Placeholder text skeleton visible
And: No actual content rendered
```

#### Test 3.3: Skeleton disappears on successful load
```
Given: Skeleton state shown
When: API response received
Then: Skeleton removed from DOM
And: Real content displayed
And: Smooth transition (no flicker)
```

### 4. Error States

#### Test 4.1: HotelsPage handles fetch error gracefully
```
Given: API returns 500 error
When: useEffect completes
Then: Error message displayed
And: "Error" heading shown in red
And: Error text visible
And: No hotel cards rendered
```

#### Test 4.2: HotelPage handles invalid hotel ID
```
Given: Hotel ID = 9999 (non-existent)
When: useEffect fetches
Then: Error message: "Hotel not found"
And: Red border on error box
And: "Back to Hotels" link visible
```

#### Test 4.3: HotelPage handles API timeout
```
Given: API request timeout after 30s
When: useEffect completes
Then: Error message displayed
And: User can navigate back
And: No partial data shown
```

---

## Navigation Tests

### 5. Page Navigation

#### Test 5.1: HotelsPage cards link to individual hotel
```
Given: HotelsPage rendered
When: User clicks hotel card
Then: Navigate to /hotels/16
And: HotelPage loads for hotel 16
```

#### Test 5.2: Back navigation from HotelPage
```
Given: HotelPage for hotel 16
When: User clicks "Back to Hotels"
Then: Navigate to /hotels
And: HotelsPage loads
And: All 18 hotels listed
```

#### Test 5.3: Direct URL navigation to hotel page
```
Given: User navigates directly to /hotels/16
When: Page loads
Then: HotelPage renders without going through list first
And: All data loads correctly
```

---

## Responsive Design Tests

### 6. Mobile Responsiveness

#### Test 6.1: HotelsPage responsive grid
```
Given: Mobile viewport (375px width)
When: Page renders
Then: Grid shows 1 column
And: Cards fill width with padding
And: Text doesn't overflow
```

#### Test 6.2: Tablet viewport
```
Given: Tablet viewport (768px width)
When: HotelsPage renders
Then: Grid shows 2 columns
And: Cards have proper spacing
```

#### Test 6.3: Desktop viewport
```
Given: Desktop viewport (1024px width)
When: HotelsPage renders
Then: Grid shows 3 columns
And: Cards maintain aspect ratio
```

#### Test 6.4: HotelPage mobile amenities
```
Given: Mobile viewport height
When: HotelPage renders
Then: Amenities grid shows 2 columns
And: All text readable without horizontal scroll
```

#### Test 6.5: Modal responsiveness
```
Given: Review modal opened on mobile
When: User views modal
Then: Max width fits screen
And: No horizontal overflow
And: Close button accessible
```

---

## Data Gaps Feature Tests

### 7. Data Gaps Rendering

#### Test 7.1: Gaps section only shows when gaps exist
```
Given: Hotel with gaps = 2
When: HotelPage renders
Then: "Help Us Learn More!" section visible
And: Section has light blue background
And: 💡 emoji displayed
```

#### Test 7.2: Gaps section hidden when no gaps
```
Given: Hotel with gaps = 0 (all categories covered)
When: HotelPage renders
Then: "Help Us Learn More!" section not visible
And: No layout shift
```

#### Test 7.3: Gap category names displayed correctly
```
Given: Gaps = ["WiFi Speed", "Parking", "Pool"]
When: HotelPage renders
Then: Each gap shows 📌 prefix
And: Names shown exactly as returned from API
And: Properly formatted (first letter capitalized)
```

#### Test 7.4: Data gap emoji styling consistent
```
Given: Multiple gaps displayed
When: HotelPage renders
Then: All gaps have consistent emoji
And: Text color matches blue theme
And: Spacing uniform between items
```

---

## Review Section Tests

### 8. Review Display

#### Test 8.1: Recent reviews show first 3
```
Given: Hotel with 50 reviews
When: HotelPage renders
Then: Exactly 3 reviews visible
And: Each shows guest_name, created_at, content
And: "View all 50 reviews →" link shown
```

#### Test 8.2: Review categories displayed as tags
```
Given: Review with 5 categories
When: HotelPage renders
Then: First 3 categories as tags visible
And: "+2 more" indicator shown
And: Tags have light background
```

#### Test 8.3: Empty reviews state
```
Given: Hotel with 0 reviews
When: HotelPage renders
Then: "No reviews yet" message shown
And: Review CTA still visible
And: Amenities section still displays
```

#### Test 8.4: Review guest names truncated if too long
```
Given: Guest name = "Very Long Guest Name Here"
When: Review rendered
Then: Text fits in card without wrapping excessively
And: Readable without overflow
```

---

## Review Modal Tests

### 9. Review Modal Interaction

#### Test 9.1: Modal opens on "Leave a Review" click
```
Given: HotelPage rendered
When: User clicks "Leave a Review" button
Then: Modal backdrop visible (bg-black/50)
And: Modal card visible
And: "Leave a Review" heading shown
And: Page behind modal still visible
```

#### Test 9.2: Modal closes on close button
```
Given: Modal open
When: User clicks "Close" button
Then: Modal removed from DOM
And: Page scrollable again
And: showReviewModal state is false
```

#### Test 9.3: Modal shows gap suggestions
```
Given: Modal open for Hotel 16
When: Modal renders
Then: 💡 section visible
And: "Consider Mentioning:" text shown
And: Top gaps listed as bullet points
And: User knows what to focus on
```

#### Test 9.4: Modal dismisses on backdrop click (future phase)
```
Note: Currently modal only closes via button
Future: Add onClick to backdrop for dismissal
```

---

## Edge Cases

### 10. Edge Cases & Boundary Conditions

#### Test 10.1: Hotel with no categories
```
Given: Hotel 11 with near-zero categories
When: HotelPage renders
Then: "Mentioned Amenities (0)" section shown
And: Empty grid displayed
And: No overflow or layout issues
```

#### Test 10.2: Hotel with many categories (>100)
```
Given: Hotel with 200+ categories
When: HotelPage renders
Then: All categories displayed (no truncation)
And: Grid layout works smoothly
And: Scrolling smooth
```

#### Test 10.3: Very long hotel name
```
Given: Hotel name = "A Very Very Very Long Hotel Name That Might Wrap"
When: HotelPage renders
Then: Name fits in header
And: No overflow in card titles
And: Text wraps appropriately
```

#### Test 10.4: Hotel ID = 1 (first hotel)
```
Given: Navigate to /hotels/1
When: HotelPage renders
Then: Correct hotel data loaded
And: No off-by-one errors
```

#### Test 10.5: Hotel ID = 999 (non-existent)
```
Given: Navigate to /hotels/999
When: HotelPage tries to load
Then: Error message: "Hotel not found"
And: 404-style error handling
And: No server error (graceful 400/error response)
```

#### Test 10.6: Hotel ID = "abc" (invalid)
```
Given: Navigate to /hotels/abc
When: HotelPage loads
Then: parseInt returns NaN
And: isNaN check prevents API call
And: Or API returns 400 error
And: Error displayed to user
```

---

## Performance Tests

### 11. Performance & Load Time

#### Test 11.1: HotelsPage initial load < 2 seconds
```
Given: Clean load, all caches cleared
When: /hotels loads
Then: FCP (First Contentful Paint) < 1s
And: LCP (Largest Contentful Paint) < 2s
And: All 18 hotels visible without scroll
```

#### Test 11.2: HotelPage initial load < 2 seconds
```
Given: Clean load to /hotels/16
When: Page loads
Then: Framework skeleton visible < 500ms
And: Full content rendered < 2s
And: Images (if any) load without blocking
```

#### Test 11.3: Hotel card hover animation smooth
```
Given: HotelsPage rendered
When: User hovers over card
Then: scale(1.05) and shadow animation
And: No jank or frame drops (60fps)
And: Transition smooth over 300ms
```

#### Test 11.4: Amenities grid renders 88 items smoothly
```
Given: 88 category tags loading
When: Grid renders
Then: No layout thrashing
And: CSS Grid handles efficiently
And: Scrolling smooth
```

#### Test 11.5: 50 reviews renders first 3 efficiently
```
Given: 50 reviews in array
When: Component renders only first 3
Then: No memory waste from hidden items
And: Slice(0, 3) working correctly
And: DOM only has 3 review elements
```

---

## User Interaction Tests

### 12. User Flows

#### Test 12.1: Complete discovery flow
```
Step 1: User loads /hotels
Then: See all 18 hotels with review counts

Step 2: Click on Hotel 16
Then: Navigate to /hotels/16

Step 3: View hotel name, location, description
Then: See "Venice Hotel" with 50 reviews

Step 4: Scroll down to see amenities (88)
Then: See full grid of amenities

Step 5: Notice "Help Us Learn More!" section
Then: See top 2 gaps with suggestions

Step 6: See recent 3 reviews with categories
Then: Click "View all 50 reviews →"

Step 7: Click "Leave a Review"
Then: Modal opens with gap suggestions
Then: Message "Coming in Phase 2.4+"

Step 8: Click "Close"
Then: Modal closes, back to page
```

#### Test 12.2: Quick hotel comparison flow
```
Step 1: Load /hotels
Step 2: Notice hotel cards show review counts
Step 3: Hotel 26 has highest count
Step 4: Click Hotel 26 to see more
Step 5: Compare amenities count visually
```

---

## Accessibility Tests

### 13. Accessibility (WCAG 2.1 AA)

#### Test 13.1: Keyboard navigation works
```
Given: HotelsPage rendered
When: User presses Tab
Then: Focus moves through hotel cards
And: Visible focus indicator (focus ring)
And: Enter key activates Link navigation
```

#### Test 13.2: Semantic HTML structure
```
Given: HotelPage rendered
When: Inspecting HTML
Then: Main section using semantic tags
And: Headings hierarchy: h1 > h2 (correct order)
And: Links have descriptive text (not "click here")
And: Buttons properly tagged as <button>
```

#### Test 13.3: Color contrast meets standards
```
Given: Text on backgrounds
When: Inspected with color contrast tool
Then: All text >= 4.5:1 contrast ratio (AA)
And: Blue links >= 3:1 ratio
And: Disabled text readable
```

#### Test 13.4: Images have alt text
```
Given: Emoji icons used (💡, 📍, ⭐, etc.)
When: Screen reader reads
Then: Context clear from surrounding text
Note: Emoji counted as icon, context sufficient
```

---

## Browser Compatibility Tests

### 14. Cross-Browser Testing

#### Test 14.1: Chrome/Edge latest version
```
Given: Chrome 120+
When: HotelsPage loads
Then: All features work
And: CSS Grid renders correctly
And: Animations smooth
```

#### Test 14.2: Firefox latest version
```
Given: Firefox 121+
When: HotelsPage loads
Then: All features work
And: No font rendering issues
And: Flexbox alignment correct
```

#### Test 14.3: Safari latest version
```
Given: Safari 17+
When: HotelsPage loads
Then: All features work
And: CSS Grid works
And: Gradient backgrounds render
```

---

## API Integration Tests

### 15. API Contract Verification

#### Test 15.1: Hotel response structure
```
Given: Fetch from /api/hotels
Then: Returns [{id, name, location, description, review_count}, ...]
And: All fields present
And: No extra fields that break component
```

#### Test 15.2: Hotel detail response structure
```
Given: Fetch from /api/hotels/16
Then: Returns {hotel: {...}, categories: [...], reviews: [...]}
And: hotel has: id, name, location, description
And: categories is array with id, name
And: reviews is array with structures
```

#### Test 15.3: Gaps response structure
```
Given: Fetch from /api/hotels/16/gaps?limit=2
Then: Returns {hotel_id, gaps: [...], stats: {...}}
And: gaps array has: category_id, category_name, gap_type, reason
And: stats has: total_categories, mentioned, missing, stale, coverage_pct
```

#### Test 15.4: Date format consistency
```
Given: Review created_at from API
When: Component renders
Then: toLocaleDateString() formats correctly
And: No invalid date errors
And: Format readable (e.g., "1/15/2024")
```

---

## State Management Tests

### 16. React State & Effects

#### Test 16.1: Initial state values correct
```
Given: Component mounts
When: Before first render
Then: hotel = null
And: categories = []
And: gaps = []
And: loading = true
And: error = null
```

#### Test 16.2: useEffect dependency array
```
Given: params prop unchanged
When: Component re-renders (parent trigger)
Then: useEffect doesn't re-run unnecessarily
And: API not called multiple times
And: No memory leaks from duplicate fetches
```

#### Test 16.3: Modal state toggle
```
Given: showReviewModal = false
When: User clicks "Leave a Review"
Then: showReviewModal updates to true
And: Modal appears in DOM

When: User clicks "Close"
Then: showReviewModal updates to false
And: Modal removed from DOM
```

---

## Deployment & Build Tests

### 17. Build & Deployment

#### Test 17.1: Next.js build succeeds
```
Given: npm run build
When: Building
Then: No errors or warnings
And: Static assets optimized
And: Dynamic routes pre-computed
```

#### Test 17.2: Static export works (if needed)
```
Given: Configured for static export
When: npm run build && npm run export
Then: HTML files generated
And: All routes accessible as static files
```

#### Test 17.3: Preview build locally
```
Given: npm run build && npm run start
When: Dev server runs
Then: All pages load correctly
And: No console errors
And: API calls work properly
```

---

## Test Execution Plan

### Phase 2.3 Test Sequence

1. **Day 1: Manual Smoke Testing**
   - Load /hotels, see all 18 hotels
   - Click to /hotels/16
   - Verify all sections render
   - Test navigation back/forth

2. **Day 2: Component Unit Tests**
   - Test each component rendering
   - Test state updates
   - Test useEffect logic

3. **Day 3: Integration Testing**
   - Test full user flows
   - Test API integration
   - Test responsive design

4. **Day 4: Edge Cases & Performance**
   - Test non-existent hotels
   - Test performance metrics
   - Test accessibility

5. **Day 5: Final QA & Documentation**
   - Browser compatibility
   - Document any issues
   - Create test results file

---

## Success Criteria

✅ All 18 hotels load and display correctly
✅ Individual hotel pages show amenities grid
✅ Data gaps section displays top 2 suggestions
✅ Recent reviews show with expandable view
✅ Review modal mock works and shows suggestions
✅ Navigation works smoothly back/forth
✅ Responsive on mobile, tablet, desktop
✅ No console errors or warnings
✅ All API integrations working
✅ Performance: Initial load < 2 seconds
✅ Accessibility: Keyboard navigable, color contrast okay
✅ All edge cases handled gracefully

---

## Known Limitations (Phase 2.3)

1. Review modal is mock only - no actual submission
2. "View all reviews" link not implemented (Phase 2.4)
3. Images/photos not included (Phase 2.5+)
4. Star ratings not aggregated (Phase 2.4)
5. Review filtering/sorting not implemented
6. Categories filtering/search not implemented (Phase 3.0+)

---

## Notes for QA/Testers

- Hotel 16 (Venice) has the most complete data (88 categories)
- Hotel 11 has sparse data (few categories) - good for edge case testing
- Hotel 26 has best coverage (25%) - good sample
- All reviews in DB are from 2023 - no timezone issues expected
- Database has mixed language categories (English + German)
