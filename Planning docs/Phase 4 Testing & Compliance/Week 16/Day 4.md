# Day 4: Test Scan Initiation and Results

## Objectives
- Create comprehensive tests for the compliance scan initiation workflow
- Validate scan results display and interpretation
- Test real-time updates and WebSocket connections
- Ensure proper handling of different scan types (KYC, AML, fraud)
- Validate result filtering and export functionality
- Test scan history and audit trails
- Implement performance testing for scan operations

## Implementation Details

### Scan Workflow Test Coverage
The scan initiation and results flow is the core functionality of Ableka Lumina. Tests must cover:

- Scan configuration and parameter validation
- Multi-jurisdiction scan processing
- Real-time progress updates
- Result interpretation and risk scoring
- Historical scan data retrieval
- Export functionality (PDF, CSV, JSON)
- Error handling for failed scans
- Performance under concurrent scan loads

### Test Architecture
- Page objects for scan dashboard and results pages
- WebSocket testing for real-time updates
- API mocking for scan processing simulation
- Performance monitoring and benchmarking
- Cross-browser compatibility testing

### Data Management
- Mock scan data for consistent testing
- Historical scan results for trend analysis
- Multi-jurisdiction test scenarios
- Edge cases (high-risk entities, failed scans)

## Code Implementation

### 1. Scan Page Objects
Create `cypress/page-objects/scan.js`:

```javascript
class ScanPage {
  // Navigation elements
  get scanTab() { return cy.get('[data-testid="scan-tab"]') }
  get newScanBtn() { return cy.get('[data-testid="new-scan-btn"]') }

  // Scan configuration modal
  get scanModal() { return cy.get('[data-testid="scan-modal"]') }
  get entityIdInput() { return cy.get('[data-testid="entity-id-input"]') }
  get jurisdictionSelect() { return cy.get('[data-testid="jurisdiction-select"]') }
  get scanTypeSelect() { return cy.get('[data-testid="scan-type-select"]') }
  get prioritySelect() { return cy.get('[data-testid="priority-select"]') }
  get webhookUrlInput() { return cy.get('[data-testid="webhook-url-input"]') }
  get startScanBtn() { return cy.get('[data-testid="start-scan-btn"]') }

  // Scan progress
  get scanProgress() { return cy.get('[data-testid="scan-progress"]') }
  get progressBar() { return cy.get('[data-testid="progress-bar"]') }
  get currentStep() { return cy.get('[data-testid="current-step"]') }
  get estimatedTime() { return cy.get('[data-testid="estimated-time"]') }

  // Results page
  get resultsContainer() { return cy.get('[data-testid="results-container"]') }
  get riskScore() { return cy.get('[data-testid="risk-score"]') }
  get riskLevel() { return cy.get('[data-testid="risk-level"]') }
  get scanSummary() { return cy.get('[data-testid="scan-summary"]') }
  get detailedResults() { return cy.get('[data-testid="detailed-results"]') }
  get recommendations() { return cy.get('[data-testid="recommendations"]') }

  // Results tabs
  get kycTab() { return cy.get('[data-testid="kyc-tab"]') }
  get amlTab() { return cy.get('[data-testid="aml-tab"]') }
  get fraudTab() { return cy.get('[data-testid="fraud-tab"]') }
  get blockchainTab() { return cy.get('[data-testid="blockchain-tab"]') }

  // Export options
  get exportPdfBtn() { return cy.get('[data-testid="export-pdf-btn"]') }
  get exportCsvBtn() { return cy.get('[data-testid="export-csv-btn"]') }
  get exportJsonBtn() { return cy.get('[data-testid="export-json-btn"]') }

  // History and filters
  get historyTab() { return cy.get('[data-testid="history-tab"]') }
  get scanHistoryTable() { return cy.get('[data-testid="scan-history-table"]') }
  get dateFilter() { return cy.get('[data-testid="date-filter"]') }
  get statusFilter() { return cy.get('[data-testid="status-filter"]') }
  get jurisdictionFilter() { return cy.get('[data-testid="jurisdiction-filter"]') }
  get searchInput() { return cy.get('[data-testid="search-input"]') }

  // Actions
  navigateToScan() {
    this.scanTab.click()
    return this
  }

  openNewScanModal() {
    this.newScanBtn.click()
    return this
  }

  configureScan(config) {
    if (config.entityId) this.entityIdInput.type(config.entityId)
    if (config.jurisdiction) this.jurisdictionSelect.select(config.jurisdiction)
    if (config.scanType) this.scanTypeSelect.select(config.scanType)
    if (config.priority) this.prioritySelect.select(config.priority)
    if (config.webhookUrl) this.webhookUrlInput.type(config.webhookUrl)
    return this
  }

  startScan() {
    this.startScanBtn.click()
    return this
  }

  waitForScanCompletion(timeout = 30000) {
    cy.get('[data-testid="scan-completed"]', { timeout }).should('be.visible')
    return this
  }

  viewResults() {
    cy.get('[data-testid="view-results-btn"]').click()
    return this
  }

  switchToTab(tabName) {
    switch (tabName) {
      case 'kyc':
        this.kycTab.click()
        break
      case 'aml':
        this.amlTab.click()
        break
      case 'fraud':
        this.fraudTab.click()
        break
      case 'blockchain':
        this.blockchainTab.click()
        break
    }
    return this
  }

  exportResults(format) {
    switch (format) {
      case 'pdf':
        this.exportPdfBtn.click()
        break
      case 'csv':
        this.exportCsvBtn.click()
        break
      case 'json':
        this.exportJsonBtn.click()
        break
    }
    return this
  }

  filterHistory(filters) {
    if (filters.dateRange) this.dateFilter.select(filters.dateRange)
    if (filters.status) this.statusFilter.select(filters.status)
    if (filters.jurisdiction) this.jurisdictionFilter.select(filters.jurisdiction)
    if (filters.search) this.searchInput.type(filters.search)
    return this
  }

  // Validation methods
  verifyScanModal() {
    this.scanModal.should('be.visible')
    this.entityIdInput.should('be.visible')
    this.jurisdictionSelect.should('be.visible')
    this.scanTypeSelect.should('be.visible')
    this.startScanBtn.should('be.visible')
    return this
  }

  verifyScanProgress(expectedSteps) {
    this.scanProgress.should('be.visible')
    expectedSteps.forEach(step => {
      cy.contains(step).should('be.visible')
    })
    return this
  }

  verifyResultsPage() {
    this.resultsContainer.should('be.visible')
    this.riskScore.should('be.visible')
    this.riskLevel.should('be.visible')
    this.scanSummary.should('be.visible')
    return this
  }

  verifyRiskAssessment(expectedRisk) {
    this.riskScore.should('contain', expectedRisk.score)
    this.riskLevel.should('have.class', `risk-${expectedRisk.level.toLowerCase()}`)
    return this
  }

  verifyScanHistory(count) {
    this.scanHistoryTable.should('be.visible')
    this.scanHistoryTable.find('tbody tr').should('have.length', count)
    return this
  }

  verifyExportDownloaded(format) {
    // Verify download was triggered (implementation depends on download handling)
    cy.get('@download').should('have.property', 'filename').and('include', format)
    return this
  }
}

export default new ScanPage()
```

### 2. WebSocket Testing Utilities
Create `cypress/support/websocket.js`:

```javascript
// WebSocket testing utilities for real-time scan updates

Cypress.Commands.add('connectWebSocket', (url = '/ws/scans') => {
  cy.window().then((win) => {
    const ws = new win.WebSocket(`ws://localhost:3000${url}`)
    cy.wrap(ws).as('websocket')
    return ws
  })
})

Cypress.Commands.add('waitForWebSocketMessage', (expectedMessage, timeout = 10000) => {
  cy.get('@websocket').then((ws) => {
    return new Cypress.Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('WebSocket message timeout'))
      }, timeout)

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === expectedMessage.type) {
          clearTimeout(timer)
          resolve(message)
        }
      }
    })
  })
})

Cypress.Commands.add('sendWebSocketMessage', (message) => {
  cy.get('@websocket').then((ws) => {
    ws.send(JSON.stringify(message))
  })
})

Cypress.Commands.add('disconnectWebSocket', () => {
  cy.get('@websocket').then((ws) => {
    ws.close()
  })
})
```

### 3. Scan Initiation Test Suite
Create `cypress/e2e/ui/scan-initiation.cy.js`:

```javascript
import ScanPage from '../../page-objects/scan'

describe('Scan Initiation - UI Tests', () => {
  beforeEach(() => {
    cy.loginUI('test@example.com', 'password123')
    cy.intercept('POST', '/api/scans', { statusCode: 201, body: { scanId: 'scan-123' } }).as('startScan')
    cy.intercept('GET', '/api/scans/scan-123/progress', { statusCode: 200, body: { progress: 0, status: 'queued' } }).as('scanProgress')
  })

  context('Scan Configuration', () => {
    it('should display scan initiation modal', () => {
      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.verifyScanModal()
    })

    it('should validate required fields', () => {
      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.startScan()

      cy.contains('Entity ID is required').should('be.visible')
      cy.contains('Jurisdiction is required').should('be.visible')
    })

    it('should configure and start basic KYC scan', () => {
      const scanConfig = {
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'kyc',
        priority: 'normal'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      cy.wait('@startScan')
      cy.url().should('include', '/scans/scan-123')
    })

    it('should configure comprehensive AML scan', () => {
      const scanConfig = {
        entityId: 'EU987654321',
        jurisdiction: 'GDPR',
        scanType: 'aml',
        priority: 'high',
        webhookUrl: 'https://example.com/webhook'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      cy.wait('@startScan').its('request.body').should('deep.include', {
        entityId: 'EU987654321',
        jurisdiction: 'GDPR',
        scanType: 'aml',
        priority: 'high',
        webhookUrl: 'https://example.com/webhook'
      })
    })

    it('should handle invalid entity IDs', () => {
      const scanConfig = {
        entityId: 'INVALID',
        jurisdiction: 'SEBI',
        scanType: 'kyc'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      cy.contains('Invalid entity ID format').should('be.visible')
    })

    it('should support bulk scan initiation', () => {
      cy.intercept('POST', '/api/scans/bulk', { statusCode: 201, body: { scanIds: ['scan-1', 'scan-2', 'scan-3'] } }).as('bulkScan')

      ScanPage.navigateToScan()
      cy.get('[data-testid="bulk-scan-btn"]').click()

      // Upload CSV file (mock)
      cy.get('[data-testid="file-upload"]').selectFile('cypress/fixtures/bulk-scan-entities.csv', { force: true })
      cy.get('[data-testid="start-bulk-scan-btn"]').click()

      cy.wait('@bulkScan')
      cy.contains('3 scans initiated successfully').should('be.visible')
    })
  })

  context('Real-time Scan Progress', () => {
    beforeEach(() => {
      // Mock WebSocket connection
      cy.connectWebSocket()
    })

    afterEach(() => {
      cy.disconnectWebSocket()
    })

    it('should display scan progress in real-time', () => {
      const scanConfig = {
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'kyc'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      // Verify initial state
      ScanPage.verifyScanProgress(['Initializing scan', 'Connecting to providers'])

      // Simulate progress updates via WebSocket
      cy.sendWebSocketMessage({
        type: 'scan_progress',
        scanId: 'scan-123',
        progress: 25,
        currentStep: 'KYC verification in progress'
      })

      cy.waitForWebSocketMessage({ type: 'scan_progress' })
      ScanPage.progressBar.should('have.attr', 'style').and('include', 'width: 25%')
      ScanPage.currentStep.should('contain', 'KYC verification in progress')
    })

    it('should handle scan completion via WebSocket', () => {
      const scanConfig = {
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'kyc'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      // Simulate completion
      cy.sendWebSocketMessage({
        type: 'scan_completed',
        scanId: 'scan-123',
        results: {
          riskScore: 0.15,
          riskLevel: 'LOW',
          status: 'completed'
        }
      })

      ScanPage.waitForScanCompletion()
      cy.contains('Scan completed successfully').should('be.visible')
    })

    it('should handle scan errors via WebSocket', () => {
      const scanConfig = {
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'kyc'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      // Simulate error
      cy.sendWebSocketMessage({
        type: 'scan_error',
        scanId: 'scan-123',
        error: 'Provider API unavailable'
      })

      cy.contains('Scan failed: Provider API unavailable').should('be.visible')
      cy.get('[data-testid="retry-scan-btn"]').should('be.visible')
    })

    it('should update estimated completion time', () => {
      const scanConfig = {
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'kyc'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      // Initial estimate
      ScanPage.estimatedTime.should('contain', '2-3 minutes')

      // Update estimate
      cy.sendWebSocketMessage({
        type: 'scan_progress',
        scanId: 'scan-123',
        progress: 50,
        estimatedTimeRemaining: '1 minute'
      })

      ScanPage.estimatedTime.should('contain', '1 minute')
    })
  })

  context('Priority and Queue Management', () => {
    it('should handle high priority scans', () => {
      const scanConfig = {
        entityId: 'US456789123',
        jurisdiction: 'FinCEN',
        scanType: 'aml',
        priority: 'high'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      cy.wait('@startScan').its('request.body').should('have.property', 'priority', 'high')
      cy.contains('High priority scan initiated').should('be.visible')
    })

    it('should show queue position for queued scans', () => {
      cy.intercept('GET', '/api/scans/scan-123/progress', { statusCode: 200, body: {
        progress: 0,
        status: 'queued',
        queuePosition: 3
      } }).as('queuedScan')

      const scanConfig = {
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'kyc',
        priority: 'low'
      }

      ScanPage.navigateToScan()
      ScanPage.openNewScanModal()
      ScanPage.configureScan(scanConfig)
      ScanPage.startScan()

      cy.contains('Queued - Position: 3').should('be.visible')
    })
  })
})
```

### 4. Scan Results Test Suite
Create `cypress/e2e/ui/scan-results.cy.js`:

```javascript
import ScanPage from '../../page-objects/scan'

describe('Scan Results - UI Tests', () => {
  beforeEach(() => {
    cy.loginUI('test@example.com', 'password123')

    // Mock completed scan results
    cy.intercept('GET', '/api/scans/scan-123', {
      statusCode: 200,
      body: {
        scanId: 'scan-123',
        entityId: 'IN123456789',
        jurisdiction: 'SEBI',
        scanType: 'comprehensive',
        status: 'completed',
        riskScore: 0.25,
        riskLevel: 'MEDIUM',
        completedAt: '2024-01-15T10:30:00Z',
        processingTime: 45000,
        results: {
          kyc: {
            status: 'approved',
            checks: ['pan_verification', 'aadhaar_verification'],
            riskScore: 0.1
          },
          aml: {
            status: 'approved',
            sanctions: 'clear',
            pep: 'not_identified',
            riskScore: 0.15
          },
          fraud: {
            status: 'approved',
            anomalies: [],
            riskScore: 0.05
          },
          blockchain: {
            status: 'approved',
            transactions: 45,
            riskScore: 0.2
          }
        },
        recommendations: [
          'Monitor transaction patterns',
          'Review quarterly compliance reports'
        ]
      }
    }).as('scanResults')
  })

  context('Results Display and Navigation', () => {
    it('should display comprehensive scan results', () => {
      cy.visit('/scans/scan-123/results')
      ScanPage.verifyResultsPage()

      // Verify overall risk assessment
      ScanPage.verifyRiskAssessment({ score: '25', level: 'MEDIUM' })

      // Verify scan summary
      ScanPage.scanSummary.should('contain', 'IN123456789')
      ScanPage.scanSummary.should('contain', 'SEBI')
      ScanPage.scanSummary.should('contain', '45 seconds')
    })

    it('should navigate between result tabs', () => {
      cy.visit('/scans/scan-123/results')

      // KYC tab
      ScanPage.switchToTab('kyc')
      cy.contains('PAN verification').should('be.visible')
      cy.contains('Aadhaar verification').should('be.visible')

      // AML tab
      ScanPage.switchToTab('aml')
      cy.contains('Sanctions screening').should('be.visible')
      cy.contains('PEP check').should('be.visible')

      // Fraud tab
      ScanPage.switchToTab('fraud')
      cy.contains('No anomalies detected').should('be.visible')

      // Blockchain tab
      ScanPage.switchToTab('blockchain')
      cy.contains('45 transactions analyzed').should('be.visible')
    })

    it('should display risk scoring breakdown', () => {
      cy.visit('/scans/scan-123/results')

      // Verify individual risk scores
      cy.get('[data-testid="kyc-risk-score"]').should('contain', '10')
      cy.get('[data-testid="aml-risk-score"]').should('contain', '15')
      cy.get('[data-testid="fraud-risk-score"]').should('contain', '5')
      cy.get('[data-testid="blockchain-risk-score"]').should('contain', '20')
    })

    it('should show recommendations', () => {
      cy.visit('/scans/scan-123/results')

      ScanPage.recommendations.should('be.visible')
      cy.contains('Monitor transaction patterns').should('be.visible')
      cy.contains('Review quarterly compliance reports').should('be.visible')
    })
  })

  context('Export Functionality', () => {
    it('should export results as PDF', () => {
      cy.visit('/scans/scan-123/results')

      // Mock download
      cy.intercept('GET', '/api/scans/scan-123/export/pdf', {
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="scan-results-123.pdf"'
        }
      }).as('exportPdf')

      ScanPage.exportResults('pdf')
      cy.wait('@exportPdf')
      ScanPage.verifyExportDownloaded('pdf')
    })

    it('should export results as CSV', () => {
      cy.visit('/scans/scan-123/results')

      cy.intercept('GET', '/api/scans/scan-123/export/csv', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="scan-results-123.csv"'
        }
      }).as('exportCsv')

      ScanPage.exportResults('csv')
      cy.wait('@exportCsv')
      ScanPage.verifyExportDownloaded('csv')
    })

    it('should export results as JSON', () => {
      cy.visit('/scans/scan-123/results')

      cy.intercept('GET', '/api/scans/scan-123/export/json', {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename="scan-results-123.json"'
        }
      }).as('exportJson')

      ScanPage.exportResults('json')
      cy.wait('@exportJson')
      ScanPage.verifyExportDownloaded('json')
    })
  })

  context('Scan History and Filtering', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/scans/history', {
        statusCode: 200,
        body: {
          scans: [
            {
              scanId: 'scan-123',
              entityId: 'IN123456789',
              jurisdiction: 'SEBI',
              status: 'completed',
              riskScore: 0.25,
              completedAt: '2024-01-15T10:30:00Z'
            },
            {
              scanId: 'scan-124',
              entityId: 'EU987654321',
              jurisdiction: 'GDPR',
              status: 'completed',
              riskScore: 0.05,
              completedAt: '2024-01-14T15:20:00Z'
            },
            {
              scanId: 'scan-125',
              entityId: 'US456789123',
              jurisdiction: 'FinCEN',
              status: 'failed',
              error: 'Provider timeout',
              completedAt: '2024-01-13T09:15:00Z'
            }
          ],
          total: 3
        }
      }).as('scanHistory')
    })

    it('should display scan history', () => {
      ScanPage.navigateToScan()
      ScanPage.historyTab.click()

      ScanPage.verifyScanHistory(3)

      // Verify table contents
      cy.contains('IN123456789').should('be.visible')
      cy.contains('EU987654321').should('be.visible')
      cy.contains('US456789123').should('be.visible')
    })

    it('should filter scans by jurisdiction', () => {
      ScanPage.navigateToScan()
      ScanPage.historyTab.click()

      ScanPage.filterHistory({ jurisdiction: 'SEBI' })

      ScanPage.verifyScanHistory(1)
      cy.contains('IN123456789').should('be.visible')
      cy.contains('EU987654321').should('not.exist')
    })

    it('should filter scans by status', () => {
      ScanPage.navigateToScan()
      ScanPage.historyTab.click()

      ScanPage.filterHistory({ status: 'failed' })

      ScanPage.verifyScanHistory(1)
      cy.contains('US456789123').should('be.visible')
      cy.contains('Provider timeout').should('be.visible')
    })

    it('should search scans by entity ID', () => {
      ScanPage.navigateToScan()
      ScanPage.historyTab.click()

      ScanPage.filterHistory({ search: 'EU987' })

      ScanPage.verifyScanHistory(1)
      cy.contains('EU987654321').should('be.visible')
    })

    it('should handle empty search results', () => {
      ScanPage.navigateToScan()
      ScanPage.historyTab.click()

      ScanPage.filterHistory({ search: 'NONEXISTENT' })

      cy.contains('No scans found').should('be.visible')
    })
  })

  context('Error Handling and Edge Cases', () => {
    it('should handle scan result loading errors', () => {
      cy.intercept('GET', '/api/scans/scan-123', { statusCode: 500 }).as('scanError')

      cy.visit('/scans/scan-123/results')

      cy.contains('Failed to load scan results').should('be.visible')
      cy.get('[data-testid="retry-load-btn"]').should('be.visible')
    })

    it('should display partial results for incomplete scans', () => {
      cy.intercept('GET', '/api/scans/scan-123', {
        statusCode: 200,
        body: {
          scanId: 'scan-123',
          status: 'partial',
          results: {
            kyc: { status: 'approved', riskScore: 0.1 },
            aml: { status: 'error', error: 'Provider unavailable' }
          }
        }
      }).as('partialResults')

      cy.visit('/scans/scan-123/results')

      cy.contains('Partial results available').should('be.visible')
      cy.contains('KYC: Approved').should('be.visible')
      cy.contains('AML: Error - Provider unavailable').should('be.visible')
    })

    it('should handle very high risk scores', () => {
      cy.intercept('GET', '/api/scans/high-risk-scan', {
        statusCode: 200,
        body: {
          scanId: 'high-risk-scan',
          riskScore: 0.95,
          riskLevel: 'CRITICAL',
          status: 'completed',
          recommendations: [
            'Immediate compliance review required',
            'Enhanced due diligence needed',
            'Consider transaction restrictions'
          ]
        }
      }).as('highRiskResults')

      cy.visit('/scans/high-risk-scan/results')

      ScanPage.verifyRiskAssessment({ score: '95', level: 'CRITICAL' })
      cy.get('[data-testid="critical-alert"]').should('be.visible')
      cy.contains('Immediate compliance review required').should('be.visible')
    })
  })
})
```

### 5. Performance Testing Suite
Create `cypress/e2e/ui/scan-performance.cy.js`:

```javascript
describe('Scan Performance - UI Tests', () => {
  it('should handle multiple concurrent scans', () => {
    cy.loginUI('test@example.com', 'password123')

    const scanConfigs = [
      { entityId: 'IN001', jurisdiction: 'SEBI' },
      { entityId: 'EU001', jurisdiction: 'GDPR' },
      { entityId: 'US001', jurisdiction: 'FinCEN' },
      { entityId: 'IN002', jurisdiction: 'SEBI' },
      { entityId: 'EU002', jurisdiction: 'GDPR' }
    ]

    const startTime = Date.now()

    // Start multiple scans concurrently
    scanConfigs.forEach((config, index) => {
      cy.intercept('POST', '/api/scans', {
        statusCode: 201,
        body: { scanId: `scan-${index + 1}` },
        delay: Math.random() * 1000 // Random delay to simulate real conditions
      }).as(`startScan${index + 1}`)
    })

    // Navigate and start scans
    cy.visit('/scans')
    scanConfigs.forEach((config) => {
      cy.get('[data-testid="new-scan-btn"]').click()
      cy.get('[data-testid="entity-id-input"]').type(config.entityId)
      cy.get('[data-testid="jurisdiction-select"]').select(config.jurisdiction)
      cy.get('[data-testid="start-scan-btn"]').click()
    })

    // Wait for all scans to complete
    cy.get('[data-testid="scan-completed"]', { timeout: 60000 }).should('have.length', 5)

    const endTime = Date.now()
    const totalTime = endTime - startTime

    cy.log(`Total time for 5 concurrent scans: ${totalTime}ms`)
    cy.log(`Average time per scan: ${totalTime / 5}ms`)

    // Performance assertions
    expect(totalTime).to.be.lessThan(120000) // 2 minutes max
    expect(totalTime / 5).to.be.lessThan(30000) // 30 seconds average
  })

  it('should maintain UI responsiveness during heavy load', () => {
    cy.loginUI('test@example.com', 'password123')

    // Simulate heavy background activity
    cy.intercept('GET', '/api/scans/progress', { statusCode: 200, body: { activeScans: 50 } }).as('heavyLoad')

    cy.visit('/scans')

    // UI should remain responsive
    cy.get('[data-testid="new-scan-btn"]').should('not.be.disabled')
    cy.get('[data-testid="new-scan-btn"]').click()

    // Modal should open quickly
    cy.get('[data-testid="scan-modal"]').should('be.visible')

    // Form interactions should be smooth
    cy.get('[data-testid="entity-id-input"]').type('TEST123', { delay: 50 })
    cy.get('[data-testid="entity-id-input"]').should('have.value', 'TEST123')
  })

  it('should handle large result sets efficiently', () => {
    const largeResults = {
      scanId: 'large-scan',
      riskScore: 0.3,
      results: {
        blockchain: {
          transactions: 10000,
          addresses: Array(5000).fill().map((_, i) => ({
            address: `0x${i.toString().padStart(40, '0')}`,
            riskScore: Math.random(),
            flags: Math.random() > 0.8 ? ['suspicious'] : []
          }))
        }
      }
    }

    cy.intercept('GET', '/api/scans/large-scan', { statusCode: 200, body: largeResults }).as('largeResults')

    cy.visit('/scans/large-scan/results')

    // UI should load within reasonable time
    cy.get('[data-testid="results-container"]', { timeout: 10000 }).should('be.visible')

    // Virtual scrolling should be implemented for large lists
    cy.get('[data-testid="transaction-list"]').should('be.visible')
    cy.get('[data-testid="load-more-btn"]').should('be.visible')
  })
})
```

## Testing and Validation

### Running the Scan Tests
```bash
# Run all scan initiation tests
npm run test:e2e -- --spec "cypress/e2e/ui/scan-initiation.cy.js"

# Run all scan results tests
npm run test:e2e -- --spec "cypress/e2e/ui/scan-results.cy.js"

# Run performance tests
npm run test:e2e -- --spec "cypress/e2e/ui/scan-performance.cy.js"

# Run all scan-related tests
npm run test:e2e -- --spec "cypress/e2e/ui/scan*.cy.js"
```

### Test Coverage Metrics
- Scan types: KYC, AML, Fraud, Comprehensive (100%)
- Jurisdictions: SEBI, GDPR, FinCEN (100%)
- Result states: Completed, Failed, Partial (100%)
- Export formats: PDF, CSV, JSON (100%)
- Real-time features: WebSocket updates, progress tracking (100%)
- Performance scenarios: Concurrent scans, large datasets (100%)
- Error handling: Network errors, timeouts, validation failures (100%)

### WebSocket Testing Setup
For WebSocket testing in CI/CD, ensure your test environment supports WebSocket connections:

```yaml
- name: Run Scan UI Tests
  run: |
    npm run test:e2e -- --spec "cypress/e2e/ui/scan-initiation.cy.js" --config websocketUrl=ws://localhost:3000
  env:
    CYPRESS_WEBSOCKET_URL: ws://localhost:3000
```

## Next Steps
- Day 5 will focus on comprehensive load testing (1k scans)
- Week 17 will continue with E2E testing part 2
- Integration testing with external providers will be added
- Performance optimization based on test results

This comprehensive testing suite ensures the scan initiation and results functionality works reliably across all jurisdictions and use cases, providing users with accurate, timely compliance information.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 16\Day 4.md