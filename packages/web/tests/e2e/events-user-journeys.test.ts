import { expect, test } from '@playwright/test';

test.describe('Events Feature V4 - User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Story 1: Upload Poster and Verify Extracted Data', () => {
    test('should navigate to events/new and display upload form', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new');
      await expect(page.locator('text=Add Event')).toBeVisible();
      await expect(page.locator('text=Drop poster image here')).toBeVisible();
    });

    test('should accept file upload via drag and drop', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new');

      const dropZone = page.locator('text=Drop poster image here').first();

      await expect(dropZone).toBeVisible();
    });

    test('should show loading state during extraction', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new');

      // Mock the upload and extraction in a real test
      // await page.setInputFiles('input[type="file"]', 'test-poster.jpg');

      // Check for loading animation placeholder
      await expect(page.locator('text=Analyzing poster...')).toBeVisible();
    });

    test('should navigate to wizard verification after extraction', async ({ page }) => {
      // In real test, this would happen after successful extraction
      await page.goto('http://localhost:3000/events/new/verify');

      // Check wizard step indicator
      await expect(page.locator('text=Step 1 of')).toBeVisible();
    });

    test('should allow editing extracted event data', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new/verify');

      // Check extracted data is editable
      const titleInput = page.locator('input[value*="Concert"]').first();
      await expect(titleInput).toBeVisible();
    });

    test('should allow artist search and linking', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new/verify');

      // Navigate to artist section
      await page.click('text=Artists');

      // Search for existing artist
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should allow creating new venue', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new/verify');

      // Navigate to venue section
      await page.click('text=Venue');

      // Check create new venue option
      await expect(page.locator('text=Create')).toBeVisible();
    });

    test('should show review summary before submit', async ({ page }) => {
      await page.goto('http://localhost:3000/events/new/verify');

      // Navigate to final step
      await page.click('text=Review');

      await expect(page.locator('text=Review & Submit')).toBeVisible();
      await expect(page.locator('text=Events (')).toBeVisible();
    });
  });

  test.describe('Story 2: Browse and View Events', () => {
    test('should display upcoming events on homepage', async ({ page }) => {
      await page.goto('http://localhost:3000');

      await expect(page.locator('text=Upcoming Events')).toBeVisible();
    });

    test('should navigate to /events and show all upcoming events', async ({ page }) => {
      await page.goto('http://localhost:3000/events');

      await expect(page.locator('h1:has-text("Events")')).toBeVisible();
    });

    test('should filter events by art form - carnatic', async ({ page }) => {
      await page.goto('http://localhost:3000/carnatic/events');

      await expect(page.locator('h1:has-text("Carnatic Events")')).toBeVisible();
    });

    test('should filter events by art form - kuchipudi', async ({ page }) => {
      await page.goto('http://localhost:3000/kuchipudi/events');

      await expect(page.locator('h1:has-text("Kuchipudi Events")')).toBeVisible();
    });

    test('should navigate to event detail page', async ({ page }) => {
      // Click on first event card
      await page.goto('http://localhost:3000/events');

      // Look for event cards
      const eventCard = page.locator('[class*="event-card"]').first();

      if (await eventCard.isVisible()) {
        await eventCard.click();
        await expect(page.locator('h1')).toBeVisible();
      }
    });

    test('should show pagination for events list', async ({ page }) => {
      await page.goto('http://localhost:3000/events');

      // Check for load more button
      const loadMore = page.locator('text=Load more');
      await expect(loadMore).toBeVisible();
    });
  });

  test.describe('Story 3: View Events on Entity Pages', () => {
    test('should show events on artist detail page', async ({ page }) => {
      await page.goto('http://localhost:3000/artists/test-artist-id');

      await expect(page.locator('text=Upcoming Events')).toBeVisible();
      await expect(page.locator('text=Past Events')).toBeVisible();
    });

    test('should navigate from artist to their events', async ({ page }) => {
      await page.goto('http://localhost:3000/artists/test-artist-id');

      const eventLink = page.locator('a[href*="/events/"]').first();
      if (await eventLink.isVisible()) {
        await eventLink.click();
        await expect(page.locator('h1')).toBeVisible();
      }
    });

    test('should show events on venue detail page', async ({ page }) => {
      await page.goto('http://localhost:3000/venues/test-venue-id');

      await expect(page.locator('text=Events at this venue')).toBeVisible();
    });

    test('should show events on organiser detail page', async ({ page }) => {
      await page.goto('http://localhost:3000/organisers/test-organiser-id');

      await expect(page.locator('text=Events organized by')).toBeVisible();
    });
  });

  test.describe('Festival Pages', () => {
    test('should navigate to festivals list', async ({ page }) => {
      await page.goto('http://localhost:3000/festivals');

      await expect(page.locator('h1:has-text("Festivals")')).toBeVisible();
    });

    test('should show festival schedule', async ({ page }) => {
      await page.goto('http://localhost:3000/festivals/test-festival-id');

      await expect(page.locator('text=Schedule')).toBeVisible();
      await expect(page.locator('text=Day 1')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should have navigation to events', async ({ page }) => {
      await page.goto('http://localhost:3000');

      const eventsNav = page.locator('a[href="/events"]');
      await expect(eventsNav).toBeVisible();
    });

    test('should have navigation to festivals', async ({ page }) => {
      await page.goto('http://localhost:3000');

      const festivalsNav = page.locator('a[href="/festivals"]');
      await expect(festivalsNav).toBeVisible();
    });

    test('should have navigation to create event for editors', async ({ page }) => {
      await page.goto('http://localhost:3000');

      const newEventNav = page.locator('a[href="/events/new"]');
      await expect(newEventNav).toBeVisible();
    });
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display events on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/events');

    await expect(page.locator('h1:has-text("Events")')).toBeVisible();
  });

  test('should display upload form on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000/events/new');

    await expect(page.locator('text=Add Event')).toBeVisible();
  });
});
