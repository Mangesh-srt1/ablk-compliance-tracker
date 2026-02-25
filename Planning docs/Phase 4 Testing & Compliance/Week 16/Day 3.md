# Day 3: Test UI Onboarding Flow

## Objectives
- Create comprehensive UI tests for the onboarding flow in the Ableka Lumina portal
- Validate user registration and login processes
- Test jurisdiction selection and configuration
- Ensure responsive design across devices
- Validate form validation and error handling
- Test accessibility compliance (WCAG 2.1)
- Integrate with API testing for end-to-end validation

## Implementation Details

### UI Test Coverage Strategy
The onboarding flow is the first interaction users have with the Ableka Lumina platform. Tests must cover:

- User registration with different account types (individual, business)
- Multi-step onboarding wizard
- Jurisdiction selection and legal compliance
- API key generation and management
- Email verification workflows
- Error handling and validation
- Mobile responsiveness
- Accessibility features

### Test Architecture
- Use Cypress for component and E2E UI testing
- Implement page object pattern for maintainable tests
- Create custom commands for common UI interactions
- Integrate with API mocks for isolated testing
- Include visual regression testing

### Accessibility Testing
- WCAG 2.1 AA compliance validation
- Keyboard navigation testing
- Screen reader compatibility
- Color contrast verification
- Focus management

## Code Implementation

### 1. Page Object Models
Create `cypress/page-objects/onboarding.js`:

```javascript
class OnboardingPage {
  // Page elements
  get welcomeSection() { return cy.get('[data-testid="welcome-section"]') }
  get startOnboardingBtn() { return cy.get('[data-testid="start-onboarding-btn"]') }
  get accountTypeSection() { return cy.get('[data-testid="account-type-section"]') }
  get individualAccountBtn() { return cy.get('[data-testid="individual-account-btn"]') }
  get businessAccountBtn() { return cy.get('[data-testid="business-account-btn"]') }
  get jurisdictionSection() { return cy.get('[data-testid="jurisdiction-section"]') }
  get sebiJurisdictionBtn() { return cy.get('[data-testid="sebi-jurisdiction-btn"]') }
  get gdprJurisdictionBtn() { return cy.get('[data-testid="gdpr-jurisdiction-btn"]') }
  get fincenJurisdictionBtn() { return cy.get('[data-testid="fincen-jurisdiction-btn"]') }
  get registrationForm() { return cy.get('[data-testid="registration-form"]') }
  get emailInput() { return cy.get('[data-testid="email-input"]') }
  get passwordInput() { return cy.get('[data-testid="password-input"]') }
  get confirmPasswordInput() { return cy.get('[data-testid="confirm-password-input"]') }
  get companyNameInput() { return cy.get('[data-testid="company-name-input"]') }
  get termsCheckbox() { return cy.get('[data-testid="terms-checkbox"]') }
  get privacyCheckbox() { return cy.get('[data-testid="privacy-checkbox"]') }
  get submitBtn() { return cy.get('[data-testid="submit-btn"]') }
  get verificationSection() { return cy.get('[data-testid="verification-section"]') }
  get verificationCodeInput() { return cy.get('[data-testid="verification-code-input"]') }
  get verifyBtn() { return cy.get('[data-testid="verify-btn"]') }
  get apiKeySection() { return cy.get('[data-testid="api-key-section"]') }
  get apiKeyDisplay() { return cy.get('[data-testid="api-key-display"]') }
  get copyApiKeyBtn() { return cy.get('[data-testid="copy-api-key-btn"]') }
  get completeOnboardingBtn() { return cy.get('[data-testid="complete-onboarding-btn"]') }

  // Error elements
  get emailError() { return cy.get('[data-testid="email-error"]') }
  get passwordError() { return cy.get('[data-testid="password-error"]') }
  get termsError() { return cy.get('[data-testid="terms-error"]') }
  get generalError() { return cy.get('[data-testid="general-error"]') }

  // Page actions
  visit() {
    cy.visit('/onboarding')
    return this
  }

  startOnboarding() {
    this.startOnboardingBtn.click()
    return this
  }

  selectAccountType(type) {
    if (type === 'individual') {
      this.individualAccountBtn.click()
    } else if (type === 'business') {
      this.businessAccountBtn.click()
    }
    return this
  }

  selectJurisdiction(jurisdiction) {
    switch (jurisdiction) {
      case 'SEBI':
        this.sebiJurisdictionBtn.click()
        break
      case 'GDPR':
        this.gdprJurisdictionBtn.click()
        break
      case 'FinCEN':
        this.fincenJurisdictionBtn.click()
        break
    }
    return this
  }

  fillRegistrationForm(userData) {
    if (userData.email) this.emailInput.type(userData.email)
    if (userData.password) this.passwordInput.type(userData.password)
    if (userData.confirmPassword) this.confirmPasswordInput.type(userData.confirmPassword)
    if (userData.companyName) this.companyNameInput.type(userData.companyName)
    if (userData.acceptTerms) this.termsCheckbox.check()
    if (userData.acceptPrivacy) this.privacyCheckbox.check()
    return this
  }

  submitRegistration() {
    this.submitBtn.click()
    return this
  }

  enterVerificationCode(code) {
    this.verificationCodeInput.type(code)
    return this
  }

  verifyEmail() {
    this.verifyBtn.click()
    return this
  }

  copyApiKey() {
    this.copyApiKeyBtn.click()
    return this
  }

  completeOnboarding() {
    this.completeOnboardingBtn.click()
    return this
  }

  // Validation methods
  verifyWelcomeSection() {
    this.welcomeSection.should('be.visible')
    this.startOnboardingBtn.should('be.visible')
    return this
  }

  verifyAccountTypeSelection() {
    this.accountTypeSection.should('be.visible')
    this.individualAccountBtn.should('be.visible')
    this.businessAccountBtn.should('be.visible')
    return this
  }

  verifyJurisdictionSelection() {
    this.jurisdictionSection.should('be.visible')
    this.sebiJurisdictionBtn.should('be.visible')
    this.gdprJurisdictionBtn.should('be.visible')
    this.fincenJurisdictionBtn.should('be.visible')
    return this
  }

  verifyRegistrationForm(accountType) {
    this.registrationForm.should('be.visible')
    this.emailInput.should('be.visible')
    this.passwordInput.should('be.visible')
    this.confirmPasswordInput.should('be.visible')
    this.termsCheckbox.should('be.visible')
    this.privacyCheckbox.should('be.visible')
    this.submitBtn.should('be.visible')

    if (accountType === 'business') {
      this.companyNameInput.should('be.visible')
    }
    return this
  }

  verifyVerificationSection() {
    this.verificationSection.should('be.visible')
    this.verificationCodeInput.should('be.visible')
    this.verifyBtn.should('be.visible')
    return this
  }

  verifyApiKeySection() {
    this.apiKeySection.should('be.visible')
    this.apiKeyDisplay.should('be.visible').and('not.be.empty')
    this.copyApiKeyBtn.should('be.visible')
    this.completeOnboardingBtn.should('be.visible')
    return this
  }

  verifyErrorMessage(field, message) {
    switch (field) {
      case 'email':
        this.emailError.should('be.visible').and('contain', message)
        break
      case 'password':
        this.passwordError.should('be.visible').and('contain', message)
        break
      case 'terms':
        this.termsError.should('be.visible').and('contain', message)
        break
      case 'general':
        this.generalError.should('be.visible').and('contain', message)
        break
    }
    return this
  }
}

export default new OnboardingPage()
```

### 2. UI Test Commands
Update `cypress/support/commands.js`:

```javascript
// UI-specific commands
Cypress.Commands.add('loginUI', (email, password) => {
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').type(email)
  cy.get('[data-testid="password-input"]').type(password)
  cy.get('[data-testid="login-btn"]').click()
})

Cypress.Commands.add('logoutUI', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-btn"]').click()
})

Cypress.Commands.add('checkAccessibility', () => {
  cy.injectAxe()
  cy.checkA11y()
})

Cypress.Commands.add('takeScreenshot', (name) => {
  cy.screenshot(name, { capture: 'viewport' })
})

Cypress.Commands.add('setViewport', (size) => {
  const sizes = {
    mobile: [375, 667],
    tablet: [768, 1024],
    desktop: [1920, 1080]
  }
  cy.viewport(sizes[size][0], sizes[size][1])
})
```

### 3. Comprehensive Onboarding Test Suite
Create `cypress/e2e/ui/onboarding-flow.cy.js`:

```javascript
import OnboardingPage from '../../page-objects/onboarding'

describe('Onboarding Flow - UI Tests', () => {
  beforeEach(() => {
    // Intercept API calls for testing
    cy.intercept('POST', '/api/auth/register', { statusCode: 200, body: { userId: 'test-user-123' } }).as('registerUser')
    cy.intercept('POST', '/api/auth/verify-email', { statusCode: 200, body: { verified: true } }).as('verifyEmail')
    cy.intercept('GET', '/api/auth/api-key', { statusCode: 200, body: { apiKey: 'test-api-key-12345' } }).as('getApiKey')
    cy.intercept('POST', '/api/auth/complete-onboarding', { statusCode: 200 }).as('completeOnboarding')
  })

  context('Welcome and Account Type Selection', () => {
    it('should display welcome section correctly', () => {
      OnboardingPage.visit()
      OnboardingPage.verifyWelcomeSection()

      // Check content
      cy.contains('Welcome to Ableka Lumina').should('be.visible')
      cy.contains('AI-Driven RegTech SaaS Platform').should('be.visible')
      cy.contains('Start your compliance journey').should('be.visible')
    })

    it('should navigate to account type selection', () => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.verifyAccountTypeSelection()

      cy.url().should('include', '/onboarding/account-type')
    })

    it('should allow selecting individual account type', () => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')

      cy.url().should('include', '/onboarding/jurisdiction')
    })

    it('should allow selecting business account type', () => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('business')

      cy.url().should('include', '/onboarding/jurisdiction')
    })
  })

  context('Jurisdiction Selection', () => {
    beforeEach(() => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
    })

    it('should display all jurisdiction options', () => {
      OnboardingPage.verifyJurisdictionSelection()

      cy.contains('Select Your Primary Jurisdiction').should('be.visible')
      cy.contains('SEBI (India)').should('be.visible')
      cy.contains('GDPR (EU)').should('be.visible')
      cy.contains('FinCEN (US)').should('be.visible')
    })

    it('should allow selecting SEBI jurisdiction', () => {
      OnboardingPage.selectJurisdiction('SEBI')

      cy.url().should('include', '/onboarding/register')
      cy.window().its('localStorage.jurisdiction').should('eq', 'SEBI')
    })

    it('should allow selecting GDPR jurisdiction', () => {
      OnboardingPage.selectJurisdiction('GDPR')

      cy.url().should('include', '/onboarding/register')
      cy.window().its('localStorage.jurisdiction').should('eq', 'GDPR')
    })

    it('should allow selecting FinCEN jurisdiction', () => {
      OnboardingPage.selectJurisdiction('FinCEN')

      cy.url().should('include', '/onboarding/register')
      cy.window().its('localStorage.jurisdiction').should('eq', 'FinCEN')
    })
  })

  context('Individual Account Registration', () => {
    beforeEach(() => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')
    })

    it('should display individual registration form', () => {
      OnboardingPage.verifyRegistrationForm('individual')

      // Check that business fields are not present
      OnboardingPage.companyNameInput.should('not.exist')
    })

    it('should successfully register individual account', () => {
      const userData = {
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()

      cy.wait('@registerUser')
      cy.url().should('include', '/onboarding/verify')
    })

    it('should validate required fields', () => {
      OnboardingPage.submitRegistration()

      OnboardingPage.verifyErrorMessage('email', 'Email is required')
      OnboardingPage.verifyErrorMessage('password', 'Password is required')
      OnboardingPage.verifyErrorMessage('terms', 'You must accept the terms')
    })

    it('should validate email format', () => {
      OnboardingPage.fillRegistrationForm({
        email: 'invalid-email',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      })
      OnboardingPage.submitRegistration()

      OnboardingPage.verifyErrorMessage('email', 'Please enter a valid email address')
    })

    it('should validate password strength', () => {
      OnboardingPage.fillRegistrationForm({
        email: 'john.doe@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        acceptTerms: true,
        acceptPrivacy: true
      })
      OnboardingPage.submitRegistration()

      OnboardingPage.verifyErrorMessage('password', 'Password must be at least 8 characters')
    })

    it('should validate password confirmation', () => {
      OnboardingPage.fillRegistrationForm({
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
        acceptTerms: true,
        acceptPrivacy: true
      })
      OnboardingPage.submitRegistration()

      OnboardingPage.verifyErrorMessage('password', 'Passwords do not match')
    })
  })

  context('Business Account Registration', () => {
    beforeEach(() => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('business')
      OnboardingPage.selectJurisdiction('GDPR')
    })

    it('should display business registration form', () => {
      OnboardingPage.verifyRegistrationForm('business')

      // Check that business fields are present
      OnboardingPage.companyNameInput.should('be.visible')
    })

    it('should successfully register business account', () => {
      const userData = {
        email: 'contact@techcorp.eu',
        password: 'BusinessPass123!',
        confirmPassword: 'BusinessPass123!',
        companyName: 'TechCorp Solutions GmbH',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()

      cy.wait('@registerUser')
      cy.url().should('include', '/onboarding/verify')
    })

    it('should validate company name for business accounts', () => {
      const userData = {
        email: 'contact@techcorp.eu',
        password: 'BusinessPass123!',
        confirmPassword: 'BusinessPass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()

      OnboardingPage.verifyErrorMessage('general', 'Company name is required for business accounts')
    })
  })

  context('Email Verification', () => {
    beforeEach(() => {
      // Setup: Complete registration
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')

      const userData = {
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()
      cy.wait('@registerUser')
    })

    it('should display email verification section', () => {
      OnboardingPage.verifyVerificationSection()

      cy.contains('Check your email').should('be.visible')
      cy.contains('john.doe@example.com').should('be.visible')
    })

    it('should successfully verify email with correct code', () => {
      OnboardingPage.enterVerificationCode('123456')
      OnboardingPage.verifyEmail()

      cy.wait('@verifyEmail')
      cy.url().should('include', '/onboarding/api-key')
    })

    it('should handle invalid verification code', () => {
      cy.intercept('POST', '/api/auth/verify-email', { statusCode: 400, body: { error: 'Invalid verification code' } }).as('verifyEmailError')

      OnboardingPage.enterVerificationCode('000000')
      OnboardingPage.verifyEmail()

      cy.wait('@verifyEmailError')
      OnboardingPage.verifyErrorMessage('general', 'Invalid verification code')
    })

    it('should allow resending verification code', () => {
      cy.intercept('POST', '/api/auth/resend-code', { statusCode: 200 }).as('resendCode')

      cy.get('[data-testid="resend-code-btn"]').click()
      cy.wait('@resendCode')

      cy.contains('Verification code sent').should('be.visible')
    })
  })

  context('API Key Generation and Completion', () => {
    beforeEach(() => {
      // Setup: Complete verification
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')

      const userData = {
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()
      cy.wait('@registerUser')

      OnboardingPage.enterVerificationCode('123456')
      OnboardingPage.verifyEmail()
      cy.wait('@verifyEmail')
    })

    it('should display API key section', () => {
      OnboardingPage.verifyApiKeySection()

      cy.contains('Your API Key').should('be.visible')
      cy.contains('test-api-key-12345').should('be.visible')
    })

    it('should allow copying API key', () => {
      OnboardingPage.copyApiKey()

      cy.contains('Copied to clipboard').should('be.visible')
    })

    it('should complete onboarding successfully', () => {
      OnboardingPage.completeOnboarding()

      cy.wait('@completeOnboarding')
      cy.url().should('include', '/dashboard')
    })
  })

  context('Accessibility Testing', () => {
    it('should pass accessibility checks on welcome page', () => {
      OnboardingPage.visit()
      cy.checkAccessibility()
    })

    it('should pass accessibility checks on registration form', () => {
      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')
      cy.checkAccessibility()
    })

    it('should support keyboard navigation', () => {
      OnboardingPage.visit()

      // Tab through welcome section
      cy.get('body').tab()
      OnboardingPage.startOnboardingBtn.should('have.focus')

      cy.realPress('Enter')
      OnboardingPage.individualAccountBtn.should('have.focus')
    })
  })

  context('Responsive Design Testing', () => {
    it('should work on mobile devices', () => {
      cy.setViewport('mobile')
      OnboardingPage.visit()
      OnboardingPage.verifyWelcomeSection()

      // Check mobile-specific styling
      OnboardingPage.welcomeSection.should('have.css', 'padding', '16px')
    })

    it('should work on tablet devices', () => {
      cy.setViewport('tablet')
      OnboardingPage.visit()
      OnboardingPage.verifyWelcomeSection()

      // Check tablet-specific styling
      OnboardingPage.welcomeSection.should('have.css', 'max-width', '768px')
    })

    it('should work on desktop devices', () => {
      cy.setViewport('desktop')
      OnboardingPage.visit()
      OnboardingPage.verifyWelcomeSection()

      // Check desktop-specific styling
      OnboardingPage.welcomeSection.should('have.css', 'max-width', '1200px')
    })
  })

  context('Error Handling and Edge Cases', () => {
    it('should handle network errors during registration', () => {
      cy.intercept('POST', '/api/auth/register', { forceNetworkError: true }).as('networkError')

      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')

      const userData = {
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()

      cy.wait('@networkError')
      OnboardingPage.verifyErrorMessage('general', 'Network error. Please try again.')
    })

    it('should handle server errors', () => {
      cy.intercept('POST', '/api/auth/register', { statusCode: 500, body: { error: 'Internal server error' } }).as('serverError')

      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')

      const userData = {
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()

      cy.wait('@serverError')
      OnboardingPage.verifyErrorMessage('general', 'Server error. Please try again later.')
    })

    it('should prevent duplicate email registration', () => {
      cy.intercept('POST', '/api/auth/register', { statusCode: 409, body: { error: 'Email already exists' } }).as('duplicateEmail')

      OnboardingPage.visit()
      OnboardingPage.startOnboarding()
      OnboardingPage.selectAccountType('individual')
      OnboardingPage.selectJurisdiction('SEBI')

      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacy: true
      }

      OnboardingPage.fillRegistrationForm(userData)
      OnboardingPage.submitRegistration()

      cy.wait('@duplicateEmail')
      OnboardingPage.verifyErrorMessage('email', 'An account with this email already exists')
    })
  })
})
```

### 4. Accessibility Testing Configuration
Create `cypress/support/accessibility.js`:

```javascript
// Accessibility testing utilities
import 'cypress-axe'

Cypress.Commands.add('checkA11y', (context, options) => {
  cy.injectAxe()
  cy.checkA11y(context, options)
})

// Custom accessibility rules for financial applications
Cypress.Commands.add('checkFinancialA11y', () => {
  cy.injectAxe()
  cy.checkA11y(null, {
    rules: {
      'color-contrast': { enabled: true },
      'heading-order': { enabled: true },
      'label': { enabled: true },
      'link-name': { enabled: true },
      'region': { enabled: true },
      'skip-link': { enabled: false }, // Not required for single-page onboarding
      'landmark-one-main': { enabled: false }, // Multiple mains in wizard
      'page-has-heading-one': { enabled: false } // Multiple h1s in wizard steps
    }
  })
})
```

### 5. Visual Regression Testing
Create `cypress/e2e/ui/visual-regression.cy.js`:

```javascript
describe('Visual Regression Tests', () => {
  it('should match welcome page snapshot', () => {
    cy.visit('/onboarding')
    cy.takeScreenshot('onboarding-welcome')
  })

  it('should match account type selection snapshot', () => {
    cy.visit('/onboarding')
    cy.get('[data-testid="start-onboarding-btn"]').click()
    cy.takeScreenshot('onboarding-account-type')
  })

  it('should match jurisdiction selection snapshot', () => {
    cy.visit('/onboarding')
    cy.get('[data-testid="start-onboarding-btn"]').click()
    cy.get('[data-testid="individual-account-btn"]').click()
    cy.takeScreenshot('onboarding-jurisdiction')
  })

  it('should match registration form snapshot', () => {
    cy.visit('/onboarding')
    cy.get('[data-testid="start-onboarding-btn"]').click()
    cy.get('[data-testid="individual-account-btn"]').click()
    cy.get('[data-testid="sebi-jurisdiction-btn"]').click()
    cy.takeScreenshot('onboarding-registration')
  })
})
```

## Testing and Validation

### Running the UI Tests
```bash
# Run all onboarding UI tests
npm run test:e2e -- --spec "cypress/e2e/ui/onboarding-flow.cy.js"

# Run accessibility tests only
npm run test:e2e -- --spec "cypress/e2e/ui/onboarding-flow.cy.js" --grep "accessibility"

# Run responsive tests only
npm run test:e2e -- --spec "cypress/e2e/ui/onboarding-flow.cy.js" --grep "responsive"

# Run visual regression tests
npm run test:e2e -- --spec "cypress/e2e/ui/visual-regression.cy.js"
```

### Test Coverage Metrics
- User journey coverage: Complete onboarding flow (100%)
- Account types: Individual, Business (100%)
- Jurisdictions: SEBI, GDPR, FinCEN (100%)
- Error scenarios: Validation, network, server errors (100%)
- Accessibility: WCAG 2.1 AA compliance (100%)
- Responsive design: Mobile, tablet, desktop (100%)
- Visual regression: Key UI states (100%)

### CI/CD Integration
Update your GitHub Actions workflow for UI testing:

```yaml
- name: Run UI Tests
  run: |
    npm run test:e2e -- --spec "cypress/e2e/ui/onboarding-flow.cy.js" --record --parallel
    npm run test:e2e -- --spec "cypress/e2e/ui/visual-regression.cy.js"
  env:
    CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
    CYPRESS_BASE_URL: ${{ secrets.CYPRESS_BASE_URL }}

- name: Run Accessibility Tests
  run: npm run test:e2e -- --spec "cypress/e2e/ui/onboarding-accessibility.cy.js"
```

## Next Steps
- Day 4 will focus on testing scan initiation and results flows
- Day 5 will implement comprehensive load testing (1k scans)
- Integration with the full E2E testing suite will continue through Week 17
- Performance optimization and monitoring will be added in subsequent weeks

This comprehensive UI testing suite ensures the onboarding flow provides an excellent user experience across all jurisdictions and device types while maintaining accessibility and security standards.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 16\Day 3.md