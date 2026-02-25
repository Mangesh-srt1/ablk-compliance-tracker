# Day 4: Component Testing and Quality Assurance

## Objective
Implement comprehensive testing strategies for React components, including unit tests, integration tests, and end-to-end tests, along with code quality tools and performance monitoring.

## Implementation Steps

1. **Set up Testing Framework**
   - Configure Jest and React Testing Library
   - Set up test utilities and helpers
   - Configure test coverage reporting

2. **Implement Component Unit Tests**
   - Write tests for individual components
   - Test component props and state
   - Mock external dependencies

3. **Create Integration Tests**
   - Test component interactions
   - Test data flow between components
   - Test accessibility features

4. **Set up End-to-End Testing**
   - Configure Playwright or Cypress
   - Write E2E test scenarios
   - Test critical user journeys

5. **Implement Code Quality Tools**
   - Configure ESLint and Prettier
   - Set up Husky for pre-commit hooks
   - Add Storybook for component documentation

6. **Performance Monitoring**
   - Add performance tests
   - Implement bundle analysis
   - Set up error tracking

## Code Snippets

### 1. Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/__mocks__/fileMock.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/setupTests.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
```

### 2. Test Setup File
```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {
    return null;
  }
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};
```

### 3. Test Utilities
```typescript
// src/test-utils/index.ts
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { I18nextProvider } from 'react-i18next';
import { AccessibilityProvider } from '../contexts/AccessibilityContext';
import { createAppTheme } from '../theme';
import i18n from '../i18n';

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createAppTheme('ltr');

  return (
    <I18nextProvider i18n={i18n}>
      <AccessibilityProvider>
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </AccessibilityProvider>
    </I18nextProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Custom test helpers
export const createMockWidget = (overrides = {}) => ({
  id: 'test-widget',
  type: 'kpi',
  title: 'Test Widget',
  config: { metric: 'compliance_rate' },
  layout: { x: 0, y: 0, w: 3, h: 2 },
  ...overrides,
});

export const mockApiResponse = (data: any) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
};

export const mockApiError = (error: any) => {
  return Promise.reject(error);
};
```

### 4. Component Unit Test Example
```typescript
// src/components/dashboard/__tests__/DashboardGrid.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { DashboardGrid } from '../DashboardGrid';
import { createMockWidget } from '../../test-utils';

describe('DashboardGrid', () => {
  const mockWidgets = [
    createMockWidget({ id: 'widget-1', title: 'Widget 1' }),
    createMockWidget({ id: 'widget-2', title: 'Widget 2' }),
  ];

  const defaultProps = {
    widgets: mockWidgets,
    onLayoutChange: jest.fn(),
    onWidgetConfigChange: jest.fn(),
    onWidgetRemove: jest.fn(),
    isEditable: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all widgets', () => {
    render(<DashboardGrid {...defaultProps} />);

    expect(screen.getByText('Widget 1')).toBeInTheDocument();
    expect(screen.getByText('Widget 2')).toBeInTheDocument();
  });

  it('calls onLayoutChange when layout changes', async () => {
    render(<DashboardGrid {...defaultProps} />);

    // Simulate layout change (this would normally come from react-grid-layout)
    const mockLayout = [
      { i: 'widget-1', x: 1, y: 0, w: 3, h: 2 },
      { i: 'widget-2', x: 4, y: 0, w: 3, h: 2 },
    ];

    // Trigger layout change (mocking the internal behavior)
    fireEvent(window, new CustomEvent('layout-change', { detail: mockLayout }));

    await waitFor(() => {
      expect(defaultProps.onLayoutChange).toHaveBeenCalledWith(mockLayout, expect.any(Object));
    });
  });

  it('shows drag handles when editable', () => {
    render(<DashboardGrid {...defaultProps} isEditable={true} />);

    const dragHandles = screen.getAllByTestId('drag-handle');
    expect(dragHandles).toHaveLength(mockWidgets.length);
  });

  it('calls onWidgetRemove when remove button is clicked', () => {
    render(<DashboardGrid {...defaultProps} isEditable={true} />);

    const removeButtons = screen.getAllByLabelText(/remove/i);
    fireEvent.click(removeButtons[0]);

    expect(defaultProps.onWidgetRemove).toHaveBeenCalledWith('widget-1');
  });

  it('is accessible with proper ARIA labels', () => {
    render(<DashboardGrid {...defaultProps} />);

    // Check for accessibility attributes
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('adapts to different screen sizes', () => {
    // Mock different breakpoints
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600, // Mobile width
    });

    render(<DashboardGrid {...defaultProps} />);

    // Component should adapt layout for mobile
    // This would test the responsive behavior
  });
});
```

### 5. Accessibility Test Utilities
```typescript
// src/test-utils/accessibility.ts
import { screen } from '@testing-library/react';

// Accessibility test helpers
export const testAccessibility = {
  // Check for ARIA labels
  hasAriaLabel: (element: HTMLElement, label?: string) => {
    if (label) {
      expect(element).toHaveAttribute('aria-label', label);
    } else {
      expect(element).toHaveAttribute('aria-label');
    }
  },

  // Check for proper heading hierarchy
  hasProperHeadingHierarchy: () => {
    const headings = screen.getAllByRole('heading');
    const levels = headings.map(h => parseInt(h.tagName.charAt(1)));

    // Check that heading levels don't skip (e.g., no H3 without H2)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  },

  // Check for keyboard navigation
  isKeyboardNavigable: (element: HTMLElement) => {
    expect(element).toHaveAttribute('tabindex', '0');
  },

  // Check for focus management
  hasFocusIndicator: (element: HTMLElement) => {
    const styles = window.getComputedStyle(element);
    expect(styles.outline).not.toBe('none');
  },

  // Check color contrast (mock implementation)
  hasGoodContrast: (element: HTMLElement) => {
    // This would integrate with a color contrast checking library
    // For now, just check that text color is defined
    const styles = window.getComputedStyle(element);
    expect(styles.color).toBeDefined();
    expect(styles.backgroundColor).toBeDefined();
  },

  // Check for screen reader content
  hasScreenReaderContent: (element: HTMLElement, content?: string) => {
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    const ariaDescribedBy = element.getAttribute('aria-describedby');

    const hasAriaContent = ariaLabel || ariaLabelledBy || ariaDescribedBy;
    expect(hasAriaContent).toBe(true);

    if (content) {
      expect(ariaLabel).toContain(content);
    }
  },
};
```

### 6. Integration Test Example
```typescript
// src/components/dashboard/__tests__/DashboardManager.integration.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { DashboardManager } from '../DashboardManager';
import { mockApiResponse } from '../../test-utils';

describe('DashboardManager Integration', () => {
  beforeEach(() => {
    // Mock fetch for template loading
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and displays dashboard templates', async () => {
    const mockTemplates = [
      {
        id: 'template-1',
        name: 'Compliance Overview',
        description: 'Standard compliance dashboard',
        widgets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue(mockApiResponse(mockTemplates));

    render(<DashboardManager />);

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Compliance Overview')).toBeInTheDocument();
    });
  });

  it('allows adding new widgets in edit mode', async () => {
    render(<DashboardManager />);

    // Enter edit mode
    const editButton = screen.getByText('Edit Layout');
    fireEvent.click(editButton);

    // Check that add widget options are visible
    expect(screen.getByText('Add Widgets')).toBeInTheDocument();

    // Add a KPI widget
    const addKpiButton = screen.getByText('KPI Card');
    fireEvent.click(addKpiButton);

    // Check that widget was added
    await waitFor(() => {
      expect(screen.getByText('New KPI Card')).toBeInTheDocument();
    });
  });

  it('saves dashboard layout changes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockApiResponse({}));

    render(<DashboardManager />);

    // Enter edit mode
    const editButton = screen.getByText('Edit Layout');
    fireEvent.click(editButton);

    // Make some changes (this would trigger layout changes)
    // ...

    // Save layout
    const saveButton = screen.getByText('Save Layout');
    fireEvent.click(saveButton);

    // Check that save was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dashboard/templates',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });
  });

  it('handles accessibility settings integration', () => {
    render(<DashboardManager />);

    // Check that accessibility context is properly integrated
    // This would test that components respond to accessibility settings
  });
});
```

### 7. End-to-End Test Configuration
```typescript
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
```

### 8. E2E Test Example
```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads dashboard successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Compliance Dashboard/);
    await expect(page.locator('text=Compliance Dashboard')).toBeVisible();
  });

  test('allows editing dashboard layout', async ({ page }) => {
    // Enter edit mode
    await page.click('text=Edit Layout');

    // Check that edit mode is active
    await expect(page.locator('text=Add Widgets')).toBeVisible();

    // Add a widget
    await page.click('text=KPI Card');

    // Check that widget was added
    await expect(page.locator('text=New KPI Card')).toBeVisible();

    // Save layout
    await page.click('text=Save Layout');

    // Check that we're back to view mode
    await expect(page.locator('text=Edit Layout')).toBeVisible();
  });

  test('supports keyboard navigation', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="skip-link"]')).toBeFocused();

    // Navigate to main content
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('is accessible', async ({ page }) => {
    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('supports multiple languages', async ({ page }) => {
    // Change language to Spanish
    await page.selectOption('select[aria-label*="language"]', 'es');

    // Check that UI is in Spanish
    await expect(page.locator('text=Panel de Cumplimiento')).toBeVisible();
  });

  test('responds to different screen sizes', async ({ page, isMobile }) => {
    if (isMobile) {
      // Test mobile-specific behavior
      await expect(page.locator('.mobile-menu')).toBeVisible();
    } else {
      // Test desktop-specific behavior
      await expect(page.locator('.desktop-toolbar')).toBeVisible();
    }
  });
});
```

### 9. ESLint and Prettier Configuration
```javascript
// .eslintrc.js
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'react-app',
    'react-app/jest',
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:testing-library/react',
    'plugin:jest-dom/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    '@typescript-eslint',
    'jsx-a11y',
    'testing-library',
    'jest-dom',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'jsx-a11y/anchor-is-valid': 'off',
    'testing-library/await-async-query': 'error',
    'testing-library/no-await-sync-query': 'error',
    'jest-dom/prefer-checked': 'error',
    'jest-dom/prefer-enabled-disabled': 'error',
    'jest-dom/prefer-required': 'error',
    'jest-dom/prefer-to-have-attribute': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

```javascript
// .prettierrc.js
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
};
```

### 10. Husky Pre-commit Hooks
```json
// package.json (excerpt)
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --findRelatedTests --passWithNoTests"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

### 11. Performance Test Example
```typescript
// src/__tests__/performance/DashboardGrid.performance.test.tsx
import React from 'react';
import { render } from '../../test-utils';
import { DashboardGrid } from '../../components/dashboard/DashboardGrid';
import { createMockWidget } from '../../test-utils';

describe('DashboardGrid Performance', () => {
  it('renders large number of widgets efficiently', () => {
    const startTime = performance.now();

    // Create 50 widgets
    const widgets = Array.from({ length: 50 }, (_, i) =>
      createMockWidget({
        id: `widget-${i}`,
        title: `Widget ${i}`,
      })
    );

    render(
      <DashboardGrid
        widgets={widgets}
        onLayoutChange={jest.fn()}
        onWidgetConfigChange={jest.fn()}
        onWidgetRemove={jest.fn()}
        isEditable={false}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in less than 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('handles layout changes without performance degradation', () => {
    const widgets = Array.from({ length: 20 }, (_, i) =>
      createMockWidget({
        id: `widget-${i}`,
        title: `Widget ${i}`,
      })
    );

    const { rerender } = render(
      <DashboardGrid
        widgets={widgets}
        onLayoutChange={jest.fn()}
        onWidgetConfigChange={jest.fn()}
        onWidgetRemove={jest.fn()}
        isEditable={false}
      />
    );

    const startTime = performance.now();

    // Simulate multiple layout changes
    for (let i = 0; i < 10; i++) {
      rerender(
        <DashboardGrid
          widgets={widgets.map(w => ({ ...w, layout: { ...w.layout, x: i } }))}
          onLayoutChange={jest.fn()}
          onWidgetConfigChange={jest.fn()}
          onWidgetRemove={jest.fn()}
          isEditable={false}
        />
      );
    }

    const endTime = performance.now();
    const updateTime = endTime - startTime;

    // Should handle updates efficiently
    expect(updateTime).toBeLessThan(200);
  });
});
```

## Notes
- Comprehensive testing strategy covering unit, integration, and E2E tests
- Accessibility testing utilities for WCAG compliance
- Performance testing to ensure efficient rendering
- Code quality tools with pre-commit hooks
- Internationalization testing for multiple languages
- Bundle analysis and error tracking setup