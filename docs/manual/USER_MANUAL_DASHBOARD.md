# Ableka Lumina Compliance Dashboard - User Manual

**Version:** 1.1  
**Last Updated:** March 3, 2026  
**Platform:** Ableka Lumina AI Compliance Engine  
**Dashboard URL:** http://localhost:4005

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [User Authentication](#4-user-authentication)
5. [Home Dashboard](#5-home-dashboard)
6. [Submitting Compliance Checks](#6-submitting-compliance-checks)
   - [6.4 AI Document Validation](#64-ai-document-validation)
   - [6.5 AI Asset Validation](#65-ai-asset-validation)
7. [Viewing Compliance Results](#7-viewing-compliance-results)
8. [Workflow Builder](#8-workflow-builder)
9. [Real-Time Alerts & Monitoring](#9-real-time-alerts--monitoring)
10. [Reporting & Analytics](#10-reporting--analytics)
11. [System Settings](#11-system-settings)
12. [Troubleshooting](#12-troubleshooting)
13. [Best Practices](#13-best-practices)
14. [Frequently Asked Questions](#14-frequently-asked-questions)

---

## 1. Introduction

### 1.1 What is Ableka Lumina?

Ableka Lumina is an AI-driven RegTech SaaS platform that automates KYC (Know Your Customer), AML (Anti-Money Laundering), and fraud detection across multiple blockchains and jurisdictions. The dashboard provides a user-friendly interface to:

- Submit and manage compliance checks
- Monitor real-time compliance alerts
- Build automated compliance workflows
- Generate compliance reports
- Track audit trails

### 1.2 Who Should Use This Manual?

This manual is designed for:

- **Compliance Officers** - Submit and review compliance checks
- **Analysts** - Monitor alerts and generate reports
- **Administrators** - Configure system settings and manage users
- **Auditors** - Review compliance history and audit trails

### 1.3 System Requirements

**Minimum Requirements:**
- **Browser:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Screen Resolution:** 1366x768 or higher (1920x1080 recommended)
- **Internet Connection:** Stable connection required for real-time features
- **JavaScript:** Must be enabled

**Recommended:**
- **Browser:** Latest version of Chrome or Firefox
- **Screen Resolution:** 1920x1080 or higher
- **RAM:** 8 GB or more for smooth performance

---

## 2. Getting Started

### 2.1 Accessing the Dashboard

**Step 1:** Open your web browser

**Step 2:** Navigate to the dashboard URL:
```
http://localhost:4005
```

**Step 3:** You should see the Ableka Lumina login screen

![Expected: Login page with email/password fields]

**Troubleshooting Access Issues:**

| Issue | Solution |
|-------|----------|
| **Page not loading** | Verify all services are running: `docker ps` |
| **Connection refused** | Check dashboard container: `docker logs compliance-dashboard` |
| **Blank white page** | Clear browser cache (Ctrl+Shift+Delete), refresh |
| **SSL/Certificate warnings** | Accept certificate (dev environment) or configure SSL |

### 2.2 First-Time Setup

**For New Installations:**

1. **Check Services Status**
   ```bash
   cd c:\Users\Mange\work\ablk-compliance-tracker\compliance-system
   docker compose ps
   ```
   
   All services should show `(healthy)` status.

2. **Verify API Connectivity**
   ```bash
   curl http://localhost:4000/api/health
   ```
   
   Expected response:
   ```json
   {"status":"healthy","timestamp":"2026-03-01T..."}
   ```

3. **Create Default Admin User**
   
   Run database initialization:
   ```bash
   docker exec compliance-postgres psql -U postgres -d compliance_db -c "
   INSERT INTO users (email, password_hash, role, created_at)
   VALUES ('admin@ableka.com', '$2a$10$...', 'admin', NOW())
   ON CONFLICT (email) DO NOTHING;
   "
   ```

### 2.3 Browser Configuration

**Recommended Settings:**

1. **Enable JavaScript**
   - Chrome: Settings > Privacy > Site Settings > JavaScript > Allowed
   - Firefox: about:config > javascript.enabled > true

2. **Disable Ad Blockers** (for dashboard domain)
   - Some ad blockers may interfere with WebSocket connections

3. **Allow Cookies**
   - Required for session management and authentication

4. **Bookmark the Dashboard**
   - Save http://localhost:4005 for quick access

---

## 3. Dashboard Overview

### 3.1 Main Navigation Layout

The dashboard uses a **sidebar navigation** layout:

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] Ableka Lumina        [User Menu] [Notifications]│
├─────────────┬───────────────────────────────────────────┤
│             │                                           │
│  📊 Home    │                                           │
│  ✓ Checks   │         Main Content Area                │
│  🔔 Alerts  │                                           │
│  🔧 Workflows│                                          │
│  📈 Reports │                                           │
│  ⚙️ Settings│                                           │
│             │                                           │
│             │                                           │
└─────────────┴───────────────────────────────────────────┘
```

### 3.2 Navigation Menu

**Primary Navigation Options:**

| Icon | Menu Item | Description | Keyboard Shortcut |
|------|-----------|-------------|-------------------|
| 📊 | **Home** | Dashboard overview with key metrics | `Ctrl+H` |
| ✓ | **Compliance Checks** | Submit and view KYC/AML checks | `Ctrl+K` |
| 🔔 | **Real-Time Alerts** | Monitor live compliance alerts | `Ctrl+A` |
| 🔧 | **Workflow Builder** | Create automated workflows | `Ctrl+W` |
| 📈 | **Reports & Analytics** | Generate compliance reports | `Ctrl+R` |
| ⚙️ | **Settings** | System configuration | `Ctrl+,` |

### 3.3 Top Bar Components

**Right Side (Top Bar):**

1. **Search Bar** (🔍)
   - Global search across all compliance checks
   - Search by: wallet address, name, jurisdiction, date
   - Supports fuzzy matching

2. **Notifications Bell** (🔔)
   - Shows count of unread alerts
   - Click to view notification dropdown
   - Red badge indicates critical alerts

3. **User Menu** (👤)
   - Profile settings
   - Change password
   - Logout

### 3.4 Dashboard Color Coding

**Risk Score Color System:**

| Risk Level | Score Range | Color | Action Required |
|------------|-------------|-------|-----------------|
| **Low** | 0-29 | 🟢 Green | Auto-approved |
| **Medium** | 30-69 | 🟡 Yellow | Review required |
| **High** | 70-100 | 🔴 Red | Escalated/Rejected |

**Status Indicators:**

| Status | Color | Icon | Meaning |
|--------|-------|------|---------|
| **Approved** | Green | ✅ | Passed all checks |
| **Pending** | Blue | ⏳ | Under review |
| **Escalated** | Orange | ⚠️ | Requires manual review |
| **Rejected** | Red | ❌ | Failed compliance |
| **Processing** | Gray | 🔄 | AI analyzing |

---

## 4. User Authentication

### 4.1 Logging In

**Step-by-Step Login Process:**

1. **Navigate to Dashboard**
   - Open: http://localhost:4005
   - You'll see the login page

2. **Enter Credentials**
   
   **Field 1: Email Address**
   ```
   admin@ableka.com
   ```
   
   **Field 2: Password**
   ```
   [Your secure password]
   ```

3. **Click "Sign In" Button**
   - Or press `Enter` key

4. **Two-Factor Authentication (if enabled)**
   - Enter 6-digit code from authenticator app
   - Or use backup code

5. **Remember Me Option**
   - ✅ Check this to stay logged in for 7 days
   - ⚠️ Do NOT use on shared computers

**Expected Result:**
- Redirected to Home Dashboard
- Welcome message appears: "Welcome back, [Your Name]"
- Navigation menu becomes active

### 4.2 Login Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **Invalid email/password** | Incorrect credentials | Reset password via "Forgot Password" link |
| **Account locked** | Too many failed attempts | Wait 15 minutes or contact admin |
| **2FA code invalid** | Expired code | Generate new code (30-second window) |
| **"Session expired"** | Inactivity timeout | Log in again |
| **"Server error"** | Backend issue | Check: `docker logs compliance-gateway` |

### 4.3 Password Reset

**Self-Service Password Reset:**

1. Click **"Forgot Password?"** on login page

2. Enter your email address
   ```
   your.email@company.com
   ```

3. Click **"Send Reset Link"**

4. Check your email inbox
   - Subject: "Ableka Lumina - Password Reset"
   - Click the reset link (valid for 1 hour)

5. Enter new password
   
   **Password Requirements:**
   - Minimum 12 characters
   - At least 1 uppercase letter (A-Z)
   - At least 1 lowercase letter (a-z)
   - At least 1 number (0-9)
   - At least 1 special character (!@#$%^&*)
   - Cannot be same as previous 5 passwords

6. Confirm new password

7. Click **"Reset Password"**

8. Login with new credentials

### 4.4 Session Management

**Session Timeout:**
- **Inactivity Timeout:** 15 minutes
- **Warning Appears:** 2 minutes before timeout
- **Action:** Click "Stay Logged In" to extend session

**Manual Logout:**

1. Click **User Menu** (top-right corner)
2. Select **"Logout"**
3. Confirm logout
4. Redirected to login page

**Security Best Practices:**
- ✅ Always log out when finished
- ✅ Never share your credentials
- ✅ Use strong, unique passwords
- ✅ Enable 2FA for added security
- ❌ Do NOT use "Remember Me" on public computers

---

## 5. Home Dashboard

### 5.1 Dashboard Overview Page

**What You See on Login:**

The Home Dashboard provides a high-level overview of compliance activities:

```
┌──────────────────────────────────────────────────────────┐
│  📊 Compliance Overview - Last 30 Days                   │
│                                                           │
│  ┌─────────────┬─────────────┬─────────────┬──────────┐│
│  │   Checks    │   Approved  │   Pending   │ Rejected ││
│  │    1,234    │     987     │     156     │    91    ││
│  │  +12% ↗     │  +8% ↗      │  -5% ↘      │  +2% ↗   ││
│  └─────────────┴─────────────┴─────────────┴──────────┘│
│                                                           │
│  📈 Risk Score Trends (Last 7 Days)                      │
│  [Line chart showing risk scores over time]              │
│                                                           │
│  🌍 Checks by Jurisdiction                               │
│  [Pie chart: AE 45%, US 30%, IN 15%, Others 10%]        │
│                                                           │
│  ⚡ Recent Alerts                                         │
│  [List of 5 most recent compliance alerts]              │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Key Metrics Cards

**Four Main Metric Cards:**

#### Card 1: Total Checks
- **Number Displayed:** Total compliance checks processed
- **Trend Arrow:** Percentage change vs. previous period
- **Click Action:** Opens "Compliance Checks" page with all checks

#### Card 2: Approved
- **Number Displayed:** Auto-approved checks (risk score 0-29)
- **Color:** Green
- **Click Action:** Filters to show only approved checks

#### Card 3: Pending Review
- **Number Displayed:** Checks awaiting manual review (risk score 30-69)
- **Color:** Orange
- **Click Action:** Opens pending checks for review

#### Card 4: Rejected
- **Number Displayed:** Failed compliance checks (risk score 70-100)
- **Color:** Red
- **Click Action:** Shows rejected checks with reasons

### 5.3 Risk Score Trends Chart

**Understanding the Chart:**

- **X-Axis:** Date/time (last 7 days)
- **Y-Axis:** Average risk score (0-100)
- **Green Zone (0-29):** Low risk - Auto approval
- **Yellow Zone (30-69):** Medium risk - Review needed
- **Red Zone (70-100):** High risk - Rejection likely

**How to Read the Chart:**

1. **Upward Trend** (↗)
   - Risk scores increasing
   - May indicate emerging patterns
   - Consider reviewing compliance rules

2. **Downward Trend** (↘)
   - Risk scores decreasing
   - Improved compliance
   - Good indicator of system effectiveness

3. **Spikes** (sudden jumps)
   - Investigate unusual activity
   - May indicate fraud attempt
   - Review recent checks manually

**Interactive Features:**
- **Hover:** Shows exact risk score at that time
- **Click Point:** Jumps to checks from that time period
- **Zoom:** Drag to select date range

### 5.4 Jurisdiction Distribution

**Pie Chart Breakdown:**

Shows percentage of compliance checks by jurisdiction (country/region):

**Common Jurisdictions:**
- **AE (UAE - Dubai):** DFSA regulations
- **US (United States):** SEC/FinCEN regulations
- **IN (India):** SEBI regulations
- **SG (Singapore):** MAS regulations
- **UK (United Kingdom):** FCA regulations

**How to Use:**
- **Hover:** Shows exact count and percentage
- **Click Slice:** Filters to that jurisdiction only
- **View Details:** Opens jurisdiction-specific report

### 5.5 Recent Alerts Panel

**Real-Time Alert Feed:**

Displays the 5 most recent compliance alerts in descending order (newest first):

**Alert Card Structure:**
```
┌────────────────────────────────────────────────┐
│ 🔴 HIGH RISK - Sanctions Match Detected        │
│ Wallet: 0x1234...5678                          │
│ Risk Score: 87/100                             │
│ Jurisdiction: AE                               │
│ Time: 2 minutes ago                            │
│ [View Details] [Investigate]                   │
└────────────────────────────────────────────────┘
```

**Alert Actions:**

1. **View Details**
   - Opens full compliance check report
   - Shows all KYC/AML/sanctions results
   - Displays AI reasoning

2. **Investigate**
   - Opens investigation workflow
   - Links related checks
   - Shows transaction history

3. **Dismiss**
   - Marks alert as reviewed
   - Requires reason (mandatory)
   - Logged in audit trail

**Alert Priority Levels:**

| Priority | Icon | Color | Response Time |
|----------|------|-------|---------------|
| **Critical** | 🔴 | Red | Immediate (< 5 min) |
| **High** | 🟠 | Orange | Urgent (< 1 hour) |
| **Medium** | 🟡 | Yellow | Standard (< 24 hours) |
| **Low** | 🔵 | Blue | Review (< 7 days) |

### 5.6 Quick Actions Panel

**Common Quick Actions (Top Right):**

1. **➕ New Compliance Check**
   - Opens submission form
   - Quick KYC/AML check
   - Keyboard: `Ctrl+N`

2. **📥 Import Batch**
   - Upload CSV/Excel file
   - Bulk compliance checks
   - Supports up to 1,000 records

3. **📊 Generate Report**
   - Quick report generation
   - Last 30 days by default
   - Export as PDF/Excel

4. **🔍 Advanced Search**
   - Search across all data
   - Advanced filters
   - Save search queries

---

## 6. Submitting Compliance Checks

### 6.1 Manual Compliance Check Submission

**Step-by-Step: Submit a Single KYC/AML Check**

#### Step 1: Navigate to Compliance Checks

1. Click **"Compliance Checks"** in left sidebar
2. Or use keyboard shortcut: `Ctrl+K`
3. Or click **"➕ New Check"** quick action button

#### Step 2: Choose Check Type

**Check Type Options:**

| Type | Use Case | Required Fields |
|------|----------|-----------------|
| **KYC (Individual)** | Person verification | Name, DOB, ID document, jurisdiction |
| **KYC (Corporate)** | Business verification | Company name, registration #, jurisdiction |
| **AML Screening** | Money laundering risk | Wallet address, transaction history |
| **Transfer Compliance** | Transaction approval | From/to addresses, amount, jurisdiction |
| **Full Compliance** | All checks combined | All of the above |

**For this example, we'll do "Transfer Compliance":**

Click **"Transfer Compliance Check"** button

#### Step 3: Fill Out the Form

**Form Fields (All Required):**

1. **From Wallet Address***
   ```
   Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
   ```
   - **Format:** Ethereum address (0x + 40 hex characters)
   - **Validation:** Checksum validated
   - **Error:** "Invalid wallet address format" if incorrect

2. **To Wallet Address***
   ```
   Example: 0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12
   ```
   - Same format as "From" address
   - Cannot be same as "From" address

3. **Transfer Amount***
   ```
   Example: 50000
   ```
   - **Format:** Numbers only (no commas)
   - **Minimum:** 1
   - **Maximum:** Jurisdiction-dependent
   - **Currency:** USD (default)

4. **Currency**
   ```
   Options: USD, EUR, GBP, AED, INR, SGD
   ```
   - Select from dropdown
   - Default: USD

5. **Jurisdiction***
   ```
   Options:
   - AE (United Arab Emirates - Dubai)
   - US (United States)
   - IN (India - SEBI)
   - SG (Singapore)
   - UK (United Kingdom)
   ```
   - **Impact:** Determines applicable compliance rules
   - **Critical:** Wrong jurisdiction = incorrect risk assessment

6. **Entity Name (From)***
   ```
   Example: John Doe
   ```
   - Full legal name
   - Match ID documents

7. **Entity Name (To)***
   ```
   Example: ABC Corporation Ltd
   ```
   - Recipient name

8. **Document Upload (Optional)**
   - **Supported Formats:** PDF, JPG, PNG
   - **Max Size:** 10 MB per file
   - **Max Files:** 5
   - **Examples:** Passport, utility bill, bank statement

9. **Additional Notes (Optional)**
   ```
   Example: First-time investor, source of funds verified separately
   ```
   - Free text field
   - Max 500 characters
   - Visible to reviewers

#### Step 4: Review Your Input

**Form Validation:**

Before submitting, the system validates:

- ✅ All required fields filled
- ✅ Wallet addresses valid (checksum)
- ✅ Amount within jurisdiction limits
- ✅ Entity names meet format requirements
- ✅ Documents under size limit

**Validation Errors (Common):**

| Error Message | Cause | Fix |
|---------------|-------|-----|
| "Invalid wallet address" | Incorrect format | Use full 0x... address |
| "Amount exceeds limit" | Too high for jurisdiction | Check jurisdiction rules |
| "Required field" | Missing data | Fill all required (*) fields |
| "File too large" | Document > 10 MB | Compress or use PDF |

#### Step 5: Submit the Check

1. **Review Summary Panel (Right Side)**
   - Shows all entered data
   - Estimated processing time: ~2-5 seconds
   - Estimated risk category (preliminary)

2. **Click "Submit Compliance Check" Button**
   - Button turns blue with loading spinner
   - Message: "Processing compliance check..."

3. **Wait for Processing**
   - **Average Time:** 2-5 seconds
   - **What's Happening:**
     - AI agents check KYC database
     - AML risk scoring (Marble AI)
     - Sanctions screening (Chainalysis if public blockchain)
     - Jurisdiction rules application
     - LLM reasoning generation

4. **Result Page Appears**
   - See section 7.1 for detailed interpretation

### 6.2 Batch Import (Multiple Checks)

**Step-by-Step: Upload Multiple Checks via CSV/Excel**

#### Step 1: Prepare Your File

**Download Template:**
1. Go to: Compliance Checks > Import Batch
2. Click **"Download CSV Template"**
3. Save file: `compliance_checks_template.csv`

**Template Structure:**
```csv
from_wallet,to_wallet,amount,currency,jurisdiction,from_name,to_name,notes
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12,50000,USD,AE,John Doe,ABC Corp,First investor
0x1234567890abcdef1234567890abcdef12345678,0xabcdef1234567890abcdef1234567890abcdef12,100000,EUR,UK,Jane Smith,XYZ Ltd,Recurring investor
```

**Field Requirements:**
- **from_wallet:** Valid Ethereum address
- **to_wallet:** Valid Ethereum address
- **amount:** Numeric (no commas)
- **currency:** USD, EUR, GBP, AED, INR, SGD
- **jurisdiction:** AE, US, IN, SG, UK
- **from_name:** Full legal name
- **to_name:** Full legal name
- **notes:** (Optional) Max 500 chars

#### Step 2: Upload File

1. Click **"Choose File"** button
2. Select your CSV/Excel file
3. Click **"Preview Import"**

**Preview Screen:**
- Shows first 10 rows
- Validates all data
- Highlights errors in red

#### Step 3: Review & Confirm

**Validation Summary:**
```
✅ 98 valid records
❌ 2 records with errors

Errors:
Row 15: Invalid wallet address format
Row 42: Amount exceeds jurisdiction limit (AE max: 1,000,000 AED)
```

**Options:**
- **Fix Errors & Re-upload:** Download error report, fix, upload again
- **Skip Invalid Records:** Process only valid records
- **Cancel Import:** Return to edit file

#### Step 4: Process Batch

1. Click **"Process Valid Records"** (if you chose to skip errors)
2. Or Click **"Process All"** (if all valid)

**Processing Status:**
```
Processing batch import...
Progress: 45/98 (45%)
Estimated time remaining: 2 minutes

[████████████░░░░░░░░░░░] 45%
```

#### Step 5: View Results

**Batch Results Summary:**
```
Import Complete!

✅ Approved: 72 (73%)
⏳ Pending Review: 18 (18%)
❌ Rejected: 8 (8%)

[Download Full Report] [View All Checks]
```

**Download Report:**
- Click **"Download Full Report"**
- Excel file with results for each row
- Includes: risk scores, statuses, reasoning

### 6.3 API Integration (for Developers)

**Programmatic Compliance Checks**

If you want to integrate Ableka Lumina with your own systems:

**API Endpoint:**
```
POST http://localhost:4000/api/v1/compliance/transfer-check
```

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "to_address": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
  "amount": 50000,
  "currency": "USD",
  "jurisdiction": "AE",
  "from_name": "John Doe",
  "to_name": "ABC Corp",
  "metadata": {
    "source_of_funds": "verified",
    "investor_type": "qualified"
  }
}
```

**Response (Success - 200 OK):**
```json
{
  "check_id": "chk_1a2b3c4d5e6f",
  "status": "APPROVED",
  "risk_score": 18,
  "confidence": 0.96,
  "reasoning": "Entity verified via KYC, no AML flags, compliant with DFSA regulations",
  "timestamp": "2026-03-01T14:30:00Z",
  "processing_time_ms": 2341
}
```

**Response (Rejected - 200 OK):**
```json
{
  "check_id": "chk_9z8y7x6w5v4u",
  "status": "REJECTED",
  "risk_score": 87,
  "confidence": 0.98,
  "reasoning": "Wallet flagged on OFAC sanctions list (SDN #12345). Transfer blocked per AE compliance requirements.",
  "flags": ["SANCTIONS_MATCH", "HIGH_RISK_COUNTRY"],
  "timestamp": "2026-03-01T14:35:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid wallet address format",
  "field": "from_address",
  "code": 400
}
```

**See API Documentation:**
- Full API docs: http://localhost:4000/api/docs
- Swagger UI with interactive testing

---

### 6.4 AI Document Validation

**Submit a compliance document for AI-powered authenticity verification**

The **AI Document Validation** feature uses a two-stage analysis pipeline:

1. **Structural analysis** (always active) – checks required fields, suspicious keywords, date consistency, content length, and SHA-256 hash integrity.
2. **LLM semantic analysis** (active when `ANTHROPIC_API_KEY` is configured) – uses Claude AI to reason about the document's authenticity and flag nuanced anomalies.

#### Step 1: Navigate to Document Validation

1. Click **"Compliance Checks"** in the left sidebar (`Ctrl+K`)
2. Click the **"Document Validation"** tab or button
3. Or go directly to: `http://localhost:4005/checks/documents`

#### Step 2: Select Document Type

Choose the document type from the dropdown:

| Category | Document Types |
|----------|---------------|
| **Identity** | Passport, National ID, Driver's License |
| **Financial** | Bank Statement, Financial Statement, Tax Document |
| **Property** | Title Deed, Property Certificate, Utility Bill |
| **Corporate** | Business Registration |
| **PE / RWA** | Subscription Agreement, Limited Partnership Agreement, Private Placement Memorandum, Capital Call Notice, Distribution Notice |
| **Other** | Any other document type |

#### Step 3: Enter Document Details

Fill in the form fields:

| Field | Required | Description |
|-------|----------|-------------|
| **Document Type** | ✅ | Selected in Step 2 |
| **Document Content** | ✅ | Paste OCR-extracted text or the full document text |
| **Issuer Name** | Recommended | Name of the issuing authority (e.g. "Dubai Land Department") |
| **Issuer Jurisdiction** | Recommended | 2-character code: `AE`, `US`, `IN`, `UK`, `SG`, `EU` |
| **Entity Name** | Recommended | Full name of the individual or company |
| **Issue Date** | Recommended | Date the document was issued (YYYY-MM-DD) |
| **Expiry Date** | Optional | Expiry date, if applicable (YYYY-MM-DD) |
| **Document Hash (SHA-256)** | Optional | 64-character hex hash for tamper-detection |

> **Tip:** Providing more optional fields improves AI analysis accuracy and reduces the risk of false `SUSPICIOUS` verdicts.

#### Step 4: Submit and View Results

Click **"Validate Document"** to submit. Results appear within 1–3 seconds.

**Understanding the Document Validation Result:**

```
┌─────────────────────────────────────────────────────────┐
│  Document Validation Result                             │
│                                                         │
│  Verdict:        ✅ AUTHENTIC          (or ⚠️/❌)       │
│  Authenticity:   92/100                                 │
│  Fraud Risk:     8/100                                  │
│                                                         │
│  ─── Integrity Check ───────────────────────────────── │
│  Hash Match:         ✅ Passed                          │
│  Expiry Valid:       ✅ Passed                          │
│  Date Consistent:    ✅ Passed                          │
│                                                         │
│  ─── AI Analysis ───────────────────────────────────── │
│  Performed:      Yes (Claude claude-3-haiku)            │
│  Confidence:     96%                                    │
│  Reasoning:      Document structure is consistent       │
│                  with a genuine UK passport.            │
│                                                         │
│  ─── Recommendations ───────────────────────────────── │
│  • Document passed AI validation checks.                │
└─────────────────────────────────────────────────────────┘
```

**Document Verdict Meanings:**

| Verdict | Color | Score | Meaning | What to Do |
|---------|-------|-------|---------|-----------|
| ✅ **AUTHENTIC** | Green | 0–34 risk | Passed all checks | Accept the document |
| ⚠️ **SUSPICIOUS** | Yellow | 35–69 risk | Anomalies detected | Escalate for manual review |
| ❌ **FORGED** | Red | 70–100 risk | High forgery probability | Reject – investigate immediately |
| 🔄 **UNVERIFIABLE** | Grey | — | Insufficient content | Request better-quality document |

**Common Flags and Their Meanings:**

| Flag | What It Means | Recommended Action |
|------|--------------|-------------------|
| `SUSPICIOUS_KEYWORD` | Document contains words like "void", "cancelled", or "specimen" | Verify document with issuer |
| `DOCUMENT_EXPIRED` | Document has passed its expiry date | Request a valid, current document |
| `HASH_MISMATCH` | Document content does not match the provided hash | Treat as potentially tampered |
| `MISSING_FIELD_*` | A required field is absent for this document type | Provide the missing information |
| `FUTURE_ISSUED_DATE` | Issue date is in the future | Document cannot be valid – reject |

#### Step 5: Take Action

Based on the verdict:

- **AUTHENTIC** → Proceed with the compliance workflow
- **SUSPICIOUS** → Click **"Escalate"** to assign to a compliance officer for manual review
- **FORGED** → Click **"Reject"** and initiate an investigation report
- **UNVERIFIABLE** → Click **"Request Resubmission"** to ask for a clearer document

---

### 6.5 AI Asset Validation

**Submit a Real-World Asset for AI-powered genuineness verification**

The **AI Asset Validation** feature validates Real-World Assets (RWA) including real estate, tokenized securities, Private Equity fund tokens, and more. It checks:

- **Suspicious keywords** in asset descriptions
- **Registry reference** presence for regulated asset types
- **Registration date** validity
- **Valuation plausibility** against minimum thresholds
- **Ownership chain** chronological consistency
- **SHA-256 hash integrity** of supporting documents
- **LLM semantic analysis** (when `ANTHROPIC_API_KEY` is configured)

#### Step 1: Navigate to Asset Validation

1. Click **"Compliance Checks"** in the left sidebar (`Ctrl+K`)
2. Click the **"Asset Validation"** tab or button
3. Or go directly to: `http://localhost:4005/checks/assets`

#### Step 2: Select Asset Type

| Category | Asset Types |
|----------|------------|
| **Real Estate** | `real_estate` – physical property / land |
| **Securities** | `tokenized_security` – on-chain tokenized equity or debt |
| **Private Equity** | `private_equity_fund`, `pe_fund_token` – LP interests and fund units |
| **Debt** | `debt_instrument` – bonds, notes, loans |
| **Other Physical** | `commodity`, `vehicle`, `art_collectible`, `intellectual_property` |
| **Other** | `other` |

> **Note:** Asset types marked with ✅ Registry Required (`real_estate`, `tokenized_security`, `private_equity_fund`, `pe_fund_token`, `debt_instrument`) must include a **Registry Reference**.

#### Step 3: Enter Asset Details

| Field | Required | Description |
|-------|----------|-------------|
| **Asset Type** | ✅ | Selected in Step 2 |
| **Asset Description** | ✅ | Full description from title deed, certificate, or token contract |
| **Owner Name** | Recommended | Current registered owner's full name |
| **Owner Jurisdiction** | Recommended | 2-character code: `AE`, `US`, `IN`, etc. |
| **Registry Reference** | Required for regulated types | Land dept. ref., ISIN, on-chain contract address |
| **Registration Date** | Recommended | ISO-8601 date (YYYY-MM-DD) |
| **Valuation (USD)** | Recommended | Declared valuation amount |
| **Ownership Chain** | Optional | List of past owners (oldest → current) with transfer dates |
| **Content Hash** | Optional | SHA-256 of supporting document for tamper-detection |

**Adding an Ownership Chain:**

Click **"+ Add Ownership Record"** for each historical owner:
```
Owner 1 (oldest):   Developer Corp LLC       Transfer: 2018-01-10
Owner 2:            Previous Owner           Transfer: 2021-08-22
Owner 3 (current):  Ahmed Al Maktoum         Transfer: 2024-06-15
```

The system verifies that:
- Transfer dates are in chronological order
- The last entry's owner matches the declared **Owner Name**

#### Step 4: Submit and View Results

Click **"Validate Asset"** to submit. Results appear within 1–3 seconds.

**Understanding the Asset Validation Result:**

```
┌─────────────────────────────────────────────────────────┐
│  Asset Validation Result                                │
│                                                         │
│  Verdict:        ✅ VALID              (or ⚠️/❌)       │
│  Validity Score: 88/100                                 │
│  Risk Score:     12/100                                 │
│                                                         │
│  ─── Integrity Check ───────────────────────────────── │
│  Hash Match:             ✅ Passed                      │
│  Ownership Chain:        ✅ Valid                       │
│  Registration Date:      ✅ Valid                       │
│                                                         │
│  ─── AI Analysis ───────────────────────────────────── │
│  Performed:      Yes (Claude claude-3-haiku)            │
│  Confidence:     94%                                    │
│  Reasoning:      Asset description and ownership        │
│                  chain are consistent with a            │
│                  legitimate Dubai real estate transfer. │
│                                                         │
│  ─── Recommendations ───────────────────────────────── │
│  • Asset passed AI validation checks.                   │
└─────────────────────────────────────────────────────────┘
```

**Asset Verdict Meanings:**

| Verdict | Color | Score | Meaning | What to Do |
|---------|-------|-------|---------|-----------|
| ✅ **VALID** | Green | 0–34 risk | Asset passed all checks | Proceed with tokenization/transfer |
| ⚠️ **SUSPICIOUS** | Yellow | 35–69 risk | Anomalies detected | Escalate for manual review |
| ❌ **INVALID** | Red | 70–100 risk | High fraud probability | Reject – do not tokenize or transfer |
| 🔄 **UNVERIFIABLE** | Grey | — | Insufficient data | Request additional documentation |

**Common Flags and Their Meanings:**

| Flag | What It Means | Recommended Action |
|------|--------------|-------------------|
| `SUSPICIOUS_ASSET_KEYWORD` | Description contains words like "disputed", "lien", or "fraudulent" | Verify with registry |
| `MISSING_REGISTRY_REFERENCE` | No registry ref provided for a type that requires one | Supply the reference number |
| `IMPLAUSIBLY_LOW_VALUATION` | Valuation is below the minimum threshold for this asset type | Obtain an independent valuation |
| `OWNERSHIP_MISMATCH` | Declared owner does not match the last ownership chain entry | Resolve the discrepancy before proceeding |
| `ASSET_HASH_MISMATCH` | Supporting document has been altered | Treat as potentially fraudulent |
| `FUTURE_REGISTRATION_DATE` | Asset registered in the future | Registration date is invalid – reject |

#### Step 5: Take Action

- **VALID** → Proceed with the PE tokenization or RWA compliance workflow
- **SUSPICIOUS** → Click **"Escalate"** for compliance officer review
- **INVALID** → Click **"Reject"** and generate an investigation report
- **UNVERIFIABLE** → Click **"Request Resubmission"** with specific data requirements

#### Combined Document + Asset Validation

To validate a document and asset together (e.g. for PE tokenization onboarding):

1. Click **"Compliance Checks"** in the left sidebar (`Ctrl+K`)
2. Click the **"Combined Validation"** tab
3. Or go directly to: `http://localhost:4005/checks/combined`
4. Fill in both the **Document** section (e.g. Subscription Agreement) and the **Asset** section (e.g. PE Fund Token)
5. Submit – the system runs both checks in parallel
6. A single **Overall Status** (`APPROVED` / `ESCALATED` / `REJECTED`) is displayed along with individual results for each check

---

## 7. Viewing Compliance Results

### 7.1 Understanding Check Results

**Result Page Layout:**

After submitting a compliance check, you'll see a detailed result page:

```
┌────────────────────────────────────────────────────────┐
│  Compliance Check Result                               │
│  Check ID: chk_1a2b3c4d5e6f                           │
│  Submitted: Mar 1, 2026 2:30 PM                       │
│  Status: ✅ APPROVED                                   │
│  Risk Score: 18/100 🟢 (Low Risk)                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  📊 Risk Breakdown                                     │
│  ├─ KYC Verification: ✅ VERIFIED (Risk: 5/100)       │
│  ├─ AML Screening:    ✅ CLEAR (Risk: 12/100)         │
│  ├─ Sanctions Check:  ✅ NO MATCH (Risk: 0/100)       │
│  └─ Jurisdiction Rules: ✅ COMPLIANT (Risk: 1/100)    │
│                                                         │
│  🤖 AI Reasoning                                       │
│  "Entity successfully verified via Ballerine KYC.      │
│   No adverse media or sanctions matches found.         │
│   Transaction amount (50,000 USD) within AE DFSA       │
│   limits for qualified investors. Wallet history       │
│   shows normal transaction patterns (Marble score: 12).│
│   Approved for transfer."                              │
│                                                         │
│  📋 Transaction Details                                │
│  From: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb     │
│  To:   0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12     │
│  Amount: 50,000 USD                                    │
│  Jurisdiction: AE (Dubai - DFSA)                       │
│                                                         │
│  [Download PDF Report] [View Audit Trail] [Recheck]   │
└────────────────────────────────────────────────────────┘
```

### 7.2 Risk Score Interpretation

**Overall Risk Score (0-100):**

The risk score is a weighted combination of multiple checks:

**Calculation Formula:**
```
Total Risk = (KYC Risk × 0.30) + 
             (AML Risk × 0.35) + 
             (Sanctions Risk × 0.30) + 
             (Jurisdiction Risk × 0.05)
```

**Component Breakdown:**

#### 1. KYC Verification Risk (Weight: 30%)

| Score | Status | Meaning |
|-------|--------|---------|
| 0-10 | ✅ Verified | Full KYC passed (liveness + document) |
| 11-30 | 🟡 Partial | Some documents verified |
| 31-70 | 🟠 Pending | Missing documents |
| 71-100 | ❌ Failed | Identity not verified |

**Data Sources:**
- Ballerine KYC API
- Document verification
- Liveness detection
- PEP (Politically Exposed Person) screening

#### 2. AML Screening Risk (Weight: 35%)

| Score | Status | Meaning |
|-------|--------|---------|
| 0-20 | ✅ Low Risk | Normal transaction patterns |
| 21-50 | 🟡 Medium | Some anomalies detected |
| 51-80 | 🟠 High | Suspicious patterns |
| 81-100 | ❌ Very High | Likely money laundering |

**Factors Analyzed:**
- Transaction velocity (frequency)
- Transaction amounts (anomalies)
- Counterparty risk
- Geographic risk
- Source of funds
- Beneficial ownership

**Data Sources:**
- Marble AI risk engine
- Historical transaction data
- Counterparty database

#### 3. Sanctions Screening Risk (Weight: 30%)

| Score | Result | Meaning |
|-------|--------|---------|
| 0 | ✅ No Match | Not on any sanctions list |
| 50-80 | 🟡 Potential Match | Name similarity, needs review |
| 100 | ❌ Confirmed Match | On sanctions list - BLOCK |

**Lists Checked:**
- OFAC SDN (US sanctions)
- UN Security Council
- EU Sanctions List
- DFSA Persons List (AE)
- HMT Sanctions (UK)
- Country-specific lists

**Data Sources:**
- Chainalysis (for public blockchains)
- Internal sanctions database (for permissioned)
- Real-time updates

#### 4. Jurisdiction Compliance Risk (Weight: 5%)

| Score | Status | Meaning |
|-------|--------|---------|
| 0-10 | ✅ Compliant | Meets all jurisdiction rules |
| 11-50 | 🟡 Review | Some rules need verification |
| 51-100 | ❌ Non-Compliant | Violates jurisdiction rules |

**Rules Checked (Example - AE/Dubai):**
- Minimum investment amount
- Investor qualification criteria
- Fund structure requirements
- Governance requirements
- Reporting obligations

### 7.3 Status Categories

**Four Possible Statuses:**

#### ✅ APPROVED (Risk Score: 0-29)

**What it means:**
- All checks passed
- Low risk entity/transaction
- **Auto-approved** by AI agents
- Ready to proceed

**Next Steps:**
- Transaction can proceed
- No manual review needed
- Logged in audit trail
- Monitor for changes

**Example Use Cases:**
- Known, verified investors
- Standard transaction amounts
- Compliant jurisdictions
- Clean KYC/AML history

---

#### ⏳ ESCALATED (Risk Score: 30-69)

**What it means:**
- **Medium risk** detected
- Requires **manual review**
- Held in pending queue
- Compliance officer review needed

**Common Reasons for Escalation:**
- First-time large transaction
- Minor KYC document issues
- Elevated AML score (but not critical)
- Jurisdiction edge cases
- Unusual transaction pattern

**Next Steps for Compliance Officers:**

1. **Review AI Reasoning**
   - Read full explanation
   - Understand risk factors

2. **Investigate Further**
   - Request additional documents
   - Contact entity for clarification
   - Review transaction history

3. **Make Decision**
   - **Approve:** Override to approved status
   - **Reject:** Block transaction with reason
   - **Request More Info:** Send back to entity

4. **Document Decision**
   - Add review notes
   - Attach supporting evidence
   - Logged in audit trail

**Time Limits:**
- Standard: 24 hours
- Urgent: 4 hours
- Critical: 1 hour

---

#### ❌ REJECTED (Risk Score: 70-100)

**What it means:**
- **High risk** detected
- Transaction **blocked**
- Auto-rejected by AI
- Cannot proceed without executive override

**Common Rejection Reasons:**

| Reason | Description | Override Possible? |
|--------|-------------|--------------------|
| **Sanctions Match** | On OFAC/UN/EU list | ❌ No (legal requirement) |
| **Failed KYC** | Identity not verified | ✅ Yes (if documents provided) |
| **AML Red Flags** | Money laundering indicators | ⚠️ Rare (requires investigation) |
| **Jurisdiction Violation** | Illegal in jurisdiction | ❌ No (regulatory) |
| **Fraudulent Activity** | Known scam/fraud patterns | ❌ No |

**Next Steps:**
- **Review Reasoning:** Understand why rejected
- **Document Review:** Save PDF report for records
- **Notify Entity:** Send rejection notice
- **Report if Required:** Some rejections must be reported to regulators
- **Block Wallet:** Add to internal blocklist

**Cannot Override:**
- Sanctions matches (legal requirement)
- Regulatory violations
- Confirmed fraud

---

#### 🔄 PROCESSING (Transient State)

**What it means:**
- Check currently running
- AI agents analyzing
- Typically 2-5 seconds

**What's Happening:**
```
[Step 1] ✅ Validating input data (0.2s)
[Step 2] 🔄 KYC verification via Ballerine (1.5s)
[Step 3] 🔄 AML screening via Marble (1.8s)
[Step 4] 🔄 Sanctions check (0.8s)
[Step 5] 🔄 Jurisdiction rules application (0.3s)
[Step 6] 🔄 AI reasoning generation (0.4s)
[Step 7] ✅ Calculating final risk score (0.1s)
Total: ~5.1 seconds
```

**If Taking Longer Than 10 Seconds:**
- External API delays (Ballerine, Marble)
- Network latency
- Check status: "Processing may take up to 30 seconds"

**If Stuck > 30 Seconds:**
- Refresh page
- Check system status
- May need to resubmit

### 7.4 Viewing Check History

**Access Check History:**

1. Go to: **Compliance Checks** (left sidebar)
2. See list of all checks (newest first)

**Filters Available:**

| Filter | Options | Use Case |
|--------|---------|----------|
| **Status** | All, Approved, Escalated, Rejected | Find specific outcomes |
| **Date Range** | Last 24h, 7d, 30d, Custom | Time-based search |
| **Jurisdiction** | AE, US, IN, SG, UK, All | Country-specific |
| **Risk Score** | Low (0-29), Medium (30-69), High (70-100) | Risk-based review |
| **Entity Name** | Text search | Find specific person/company |
| **Wallet Address** | Full or partial address | Track specific wallet |

**Sorting:**
- **Newest First** (default)
- **Oldest First**
- **Highest Risk First**
- **Lowest Risk First**
- **By Jurisdiction**

**Table Columns:**

| Column | Description | Sortable? |
|--------|-------------|-----------|
| **Check ID** | Unique identifier | ✅ |
| **Timestamp** | When submitted | ✅ |
| **From → To** | Wallet addresses (truncated) | ❌ |
| **Amount** | Transfer amount + currency | ✅ |
| **Jurisdiction** | Country code | ✅ |
| **Risk Score** | 0-100 with color | ✅ |
| **Status** | Badge (Approved/Escalated/Rejected) | ✅ |
| **Actions** | View, Download, Recheck buttons | ❌ |

**Pagination:**
- 20 results per page (default)
- Options: 10, 20, 50, 100 per page
- Navigate: ← Previous | 1 2 3 ... 10 | Next →

### 7.5 Exporting Reports

**Export Individual Check:**

1. Open check result page
2. Click **"Download PDF Report"**

**PDF Report Contains:**
- Check ID and timestamp
- Full risk score breakdown
- AI reasoning (full text)
- Transaction details
- All flagged issues
- Compliance officer notes (if any)
- Audit trail
- Digital signature (cryptographically signed)

**Export Bulk Checks:**

1. Go to: Compliance Checks
2. Apply filters (e.g., last 30 days, jurisdiction AE)
3. Click **"Export"** button (top right)
4. Choose format:
   - **CSV** - For Excel analysis
   - **PDF** - For presentation/printing
   - **JSON** - For API integration

**CSV Export Columns:**
```csv
check_id,timestamp,from_wallet,to_wallet,from_name,to_name,amount,currency,jurisdiction,risk_score,status,kyc_risk,aml_risk,sanctions_risk,jurisdiction_risk,reasoning
chk_1a2b3c,2026-03-01T14:30:00Z,0x742d35...,0x8626f8...,John Doe,ABC Corp,50000,USD,AE,18,APPROVED,5,12,0,1,"Entity verified..."
```

**Report Delivery:**
- **Browser Download:** Immediate download
- **Email:** Send to specified email (for large files)
- **Scheduled Reports:** Set up automatic daily/weekly exports

---

## 8. Workflow Builder

### 8.1 What is Workflow Builder?

**Purpose:**
Automate repetitive compliance tasks by creating rule-based workflows.

**Use Cases:**
- Auto-approve low-risk entities
- Auto-escalate specific jurisdictions
- Route checks to specific reviewers
- Trigger alerts on high-risk patterns
- Send notifications to stakeholders

**Example Workflow:**
```
IF (jurisdiction = "AE" AND amount > 500000 AND risk_score > 30)
THEN escalate to "Senior Compliance Officer"
AND send email notification
AND flag for manual review within 2 hours
```

### 8.2 Creating a Workflow

**Step-by-Step: Build Your First Workflow**

#### Step 1: Access Workflow Builder

1. Click **"Workflow Builder"** in left sidebar (🔧)
2. Or keyboard shortcut: `Ctrl+W`
3. Click **"➕ Create New Workflow"** button

#### Step 2: Name Your Workflow

**Workflow Details:**

1. **Workflow Name***
   ```
   Example: High-Value AE Transfers - Senior Review
   ```
   - Descriptive name
   - Max 100 characters

2. **Description**
   ```
   Example: All UAE transfers over $500K escalated to senior compliance officer for manual review within 2 hours
   ```
   - What this workflow does
   - Max 500 characters

3. **Status**
   - ✅ **Active** - Workflow runs automatically
   - ⏸️ **Draft** - Save but don't run yet
   - ❌ **Disabled** - Turn off temporarily

4. **Priority**
   - **High** - Runs first
   - **Medium** - Standard priority
   - **Low** - Runs last

#### Step 3: Define Trigger Conditions

**When should this workflow run?**

**Trigger Options:**

1. **On Compliance Check Submission**
   - Runs immediately when check created
   - Most common trigger

2. **On Risk Score Calculation**
   - Runs after AI calculates risk
   - Use for risk-based routing

3. **On Manual Review**
   - Runs when officer reviews check
   - Use for approval workflows

4. **On Schedule**
   - Runs at specified times (e.g., daily 9 AM)
   - Use for batch processing

**For our example: Select "On Risk Score Calculation"**

#### Step 4: Add Conditions (IF Statements)

**Condition Builder Interface:**

```
┌────────────────────────────────────────────────┐
│  IF all of the following conditions are met:   │
│                                                 │
│  [+] Add Condition                             │
│                                                 │
│  Condition 1:                                  │
│  [Jurisdiction] [equals ▼] [AE ▼]             │
│  [AND ▼] [×]                                   │
│                                                 │
│  Condition 2:                                  │
│  [Amount] [greater than ▼] [500000]           │
│  [AND ▼] [×]                                   │
│                                                 │
│  Condition 3:                                  │
│  [Risk Score] [greater than ▼] [30]           │
│  [×]                                           │
│                                                 │
│  [+] Add Condition                             │
└────────────────────────────────────────────────┘
```

**Available Fields:**

| Field | Operators | Values |
|-------|-----------|--------|
| **Jurisdiction** | equals, not equals | AE, US, IN, SG, UK |
| **Amount** | >, <, =, ≥, ≤ | Numeric value |
| **Currency** | equals | USD, EUR, GBP, AED |
| **Risk Score** | >, <, =, ≥, ≤, range | 0-100 |
| **KYC Status** | equals | Verified, Partial, Failed |
| **AML Risk** | >, <, =, ≥, ≤ | 0-100 |
| **Sanctions Match** | equals | Yes, No |
| **From Wallet** | equals, contains | Wallet address |
| **To Wallet** | equals, contains | Wallet address |
| **Entity Name** | contains | Text string |

**Logical Operators:**
- **AND** - All conditions must be true
- **OR** - At least one condition must be true
- **NOT** - Condition must be false

**Example Conditions:**

**Simple:**
```
IF risk_score > 70
```

**Complex:**
```
IF (jurisdiction = "AE" OR jurisdiction = "US")
AND amount > 100000
AND (kyc_status = "Verified" OR kyc_status = "Partial")
AND sanctions_match = "No"
```

#### Step 5: Define Actions (THEN Statements)

**What should happen when conditions are met?**

**Action Types:**

1. **Change Status**
   - Auto-approve
   - Escalate for review
   - Reject
   - Mark as pending

2. **Assign to User**
   - Route to specific compliance officer
   - Load balance across team
   - Based on jurisdiction expertise

3. **Send Notification**
   - Email
   - SMS
   - Slack/Teams webhook
   - In-app notification

4. **Add Flag/Tag**
   - High priority
   - Fast-track
   - Special handling required
   - Custom tags

5. **Trigger Webhook**
   - Call external API
   - Integration with other systems
   - Custom automations

6. **Generate Report**
   - Create PDF report
   - Email to stakeholders
   - Archive to storage

**For our example:**

```
┌────────────────────────────────────────────────┐
│  THEN perform the following actions:           │
│                                                 │
│  Action 1: Change Status                       │
│  [Set Status to:] [ESCALATED ▼]               │
│  [×]                                           │
│                                                 │
│  Action 2: Assign to User                      │
│  [Assign to:] [Senior Compliance Officer ▼]   │
│  [×]                                           │
│                                                 │
│  Action 3: Send Notification                   │
│  [Send Email to:] [senior.officer@company.com]│
│  [Subject:] High-Value AE Transfer - Review    │
│  [Template:] [Standard Escalation ▼]          │
│  [×]                                           │
│                                                 │
│  Action 4: Add Tag                             │
│  [Tag:] [HIGH_PRIORITY]                       │
│  [×]                                           │
│                                                 │
│  [+] Add Action                                │
└────────────────────────────────────────────────┘
```

#### Step 6: Set Time Limits (Optional)

**SLA (Service Level Agreement) Configuration:**

```
┌────────────────────────────────────────────────┐
│  Time Limits & Escalation                      │
│                                                 │
│  ☑ Require review within: [2] hours            │
│                                                 │
│  If not reviewed within this time:             │
│  ☐ Send reminder notification                  │
│  ☐ Escalate to manager                         │
│  ☐ Auto-reject                                 │
│                                                 │
└────────────────────────────────────────────────┘
```

#### Step 7: Test Workflow

**Before activating, test with sample data:**

1. Click **"Test Workflow"** button

2. Enter test data:
   ```
   From: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
   To: 0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12
   Amount: 600000
   Currency: USD
   Jurisdiction: AE
   Risk Score: 45
   ```

3. Click **"Run Test"**

4. **Test Results:**
   ```
   ✅ Workflow Triggered
   
   Conditions Matched:
   ✅ Jurisdiction = AE
   ✅ Amount > 500000
   ✅ Risk Score > 30
   
   Actions Executed:
   ✅ Status changed to ESCALATED
   ✅ Assigned to Senior Compliance Officer
   ✅ Email sent to senior.officer@company.com
   ✅ Tag "HIGH_PRIORITY" added
   
   Execution Time: 0.34 seconds
   ```

5. **If test fails:**
   - Review conditions
   - Check action configuration
   - Fix errors
   - Test again

#### Step 8: Save & Activate

1. Click **"Save Workflow"** button
   - Saves as draft

2. Toggle **Status** to **Active**

3. Click **"Activate Workflow"**

4. Confirmation message:
   ```
   ✅ Workflow "High-Value AE Transfers - Senior Review" activated
   
   This workflow will now run automatically for all new compliance checks.
   ```

### 8.3 Managing Workflows

**Workflow List Page:**

View all workflows:

| Name | Status | Priority | Triggered | Last Run | Actions |
|------|--------|----------|-----------|----------|---------|
| High-Value AE Transfers | ✅ Active | High | 156 times | 2 min ago | Edit, Disable, Clone, Delete |
| Auto-Approve Low Risk | ✅ Active | Low | 2,341 times | 5 min ago | Edit, Disable, Clone, Delete |
| Sanctions Alert | ✅ Active | High | 3 times | 1 hour ago | Edit, Disable, Clone, Delete |

**Workflow Actions:**

1. **Edit** - Modify conditions/actions
2. **Disable** - Turn off temporarily
3. **Clone** - Duplicate and modify
4. **Delete** - Permanently remove
5. **View Logs** - See execution history

### 8.4 Workflow Templates

**Pre-Built Workflow Templates:**

Click **"Use Template"** when creating a new workflow:

| Template | Description | Use Case |
|----------|-------------|----------|
| **Auto-Approve Low Risk** | Auto-approve risk score < 20 | Speed up low-risk checks |
| **High Risk Escalation** | Escalate risk score > 70 | Ensure manual review |
| **Sanctions Alert** | Immediate alert on sanctions match | Compliance requirement |
| **First-Time Investor** | Extra scrutiny for new wallets | Fraud prevention |
| **Large Transaction** | Flag amounts > jurisdiction limit | Regulatory oversight |
| **Jurisdiction Routing** | Route by jurisdiction to experts | Optimize review process |

**Customization:**
- All templates are fully customizable
- Modify conditions and actions
- Save as your own template

### 8.5 Workflow Analytics

**View Workflow Performance:**

Click on a workflow name to see analytics:

```
┌────────────────────────────────────────────────┐
│  Workflow: High-Value AE Transfers             │
│  Status: ✅ Active                             │
│                                                 │
│  📊 Performance (Last 30 Days)                 │
│  ├─ Triggered: 156 times                       │
│  ├─ Success Rate: 98.7% (154/156)             │
│  ├─ Failed: 2 (errors logged)                 │
│  ├─ Avg Execution Time: 0.42 seconds          │
│  └─ Time Saved: ~8.5 hours vs manual review   │
│                                                 │
│  🎯 Impact                                     │
│  ├─ Checks Escalated: 154                     │
│  ├─ Avg Review Time: 3.2 hours                │
│  ├─ SLA Compliance: 96% (within 2 hours)      │
│  └─ False Positives: 4 (2.6%)                 │
│                                                 │
│  📈 Trend Chart                                │
│  [Bar chart showing triggers per day]          │
│                                                 │
│  [View Execution Logs] [Export Report]         │
└────────────────────────────────────────────────┘
```

---

## 9. Real-Time Alerts & Monitoring

### 9.1 Alerts Dashboard

**Access Real-Time Alerts:**

1. Click **"Real-Time Alerts"** in left sidebar (🔔)
2. Or keyboard shortcut: `Ctrl+A`

**Alerts Dashboard Layout:**

```
┌────────────────────────────────────────────────┐
│  🔔 Real-Time Compliance Alerts                │
│  [All ▼] [Last 24h ▼] [🔍 Search]    [Filter] │
├────────────────────────────────────────────────┤
│                                                 │
│  🔴 CRITICAL - Sanctions Match Detected        │
│  Wallet: 0x1234...5678 | Risk: 100/100        │
│  "Wallet matches OFAC SDN #12345"             │
│  2 minutes ago | [Investigate] [Dismiss]       │
│  ────────────────────────────────────────────  │
│                                                 │
│  🟠 HIGH - Unusual Transaction Pattern         │
│  Wallet: 0xabcd...efgh | Risk: 78/100         │
│  "Velocity 10x normal, $2M in 1 hour"         │
│  15 minutes ago | [Investigate] [Dismiss]      │
│  ────────────────────────────────────────────  │
│                                                 │
│  🟡 MEDIUM - KYC Document Expiring Soon        │
│  Entity: John Doe | Document: Passport         │
│  "Passport expires in 15 days"                │
│  1 hour ago | [Request Renewal] [Dismiss]      │
│  ────────────────────────────────────────────  │
│                                                 │
│  [Load More Alerts]                            │
└────────────────────────────────────────────────┘
```

### 9.2 Alert Types

**Critical Alerts (🔴 Red):**

| Alert | Trigger | Action Required |
|-------|---------|-----------------|
| **Sanctions Match** | Wallet on OFAC/UN/EU list | Block immediately, report |
| **Fraud Detected** | Known scam pattern | Block wallet, investigate |
| **System Critical** | Database/service down | IT escalation |
| **Data Breach Attempt** | Unauthorized access | Security team alert |

**Response Time:** Immediate (< 5 minutes)

---

**High Priority Alerts (🟠 Orange):**

| Alert | Trigger | Action Required |
|-------|---------|-----------------|
| **High Risk Transaction** | Risk score > 70 | Manual review within 1 hour |
| **Unusual Pattern** | Anomaly detected (10x velocity) | Investigate within 4 hours |
| **Large Transfer** | Amount > jurisdiction max | Verify legitimacy |
| **Multiple Failed Checks** | Same wallet rejected 3+ times | Investigate fraud |

**Response Time:** Urgent (< 1 hour)

---

**Medium Priority Alerts (🟡 Yellow):**

| Alert | Trigger | Action Required |
|-------|---------|-----------------|
| **Escalated Check** | Risk score 30-69 | Review within 24 hours |
| **Document Expiring** | KYC documents expire <30 days | Request renewal |
| **Pending Review** | Check awaiting approval >12h | Prioritize review |
| **Jurisdiction Change** | Entity moved to new jurisdiction | Re-verify compliance |

**Response Time:** Standard (< 24 hours)

---

**Low Priority Alerts (🔵 Blue):**

| Alert | Trigger | Action Required |
|-------|---------|-----------------|
| **Informational** | FYI only (e.g., new feature) | Review when convenient |
| **Scheduled Reminder** | Periodic review reminder | Follow up within 7 days |
| **System Update** | New compliance rules loaded | Acknowledge |

**Response Time:** Review within 7 days

### 9.3 Investigating Alerts

**Step-by-Step: Investigate a High-Risk Alert**

#### Step 1: Click "Investigate" Button

Opens alert investigation panel:

```
┌────────────────────────────────────────────────┐
│  🔍 Alert Investigation                        │
│  Alert ID: alrt_9z8y7x6w                      │
│  Created: Mar 1, 2026 2:45 PM                 │
│  ────────────────────────────────────────────  │
│                                                 │
│  🟠 HIGH - Unusual Transaction Pattern         │
│                                                 │
│  📊 Risk Factors                               │
│  ├─ Transaction Velocity: 10x normal (100%)   │
│  ├─ Amount: $2M in 1 hour (85%)               │
│  ├─ New Counterparties: 15 new wallets (65%)  │
│  └─ Geographic Risk: High-risk country (40%)  │
│                                                 │
│  🔗 Related Checks                             │
│  [chk_abc123] $500K to 0x1234... (45 min ago) │
│  [chk_def456] $700K to 0xabcd... (30 min ago) │
│  [chk_ghi789] $800K to 0xef01... (15 min ago) │
│                                                 │
│  💼 Entity Profile                             │
│  Name: XYZ Corporation                         │
│  Jurisdiction: US                              │
│  Account Age: 6 months                         │
│  Previous Checks: 23 (all approved)           │
│  Average Transaction: $50K                     │
│                                                 │
│  📈 Transaction History (Last 30 Days)         │
│  [Chart showing spike in activity]             │
│                                                 │
│  🤖 AI Analysis                                │
│  "Significant deviation from normal patterns.  │
│   Recommended: Contact entity to verify        │
│   legitimacy. Possible scenarios:              │
│   1. Legitimate bulk investment (60%)          │
│   2. Account takeover/fraud (30%)              │
│   3. Money laundering attempt (10%)"           │
│                                                 │
│  [Request Documentation] [Contact Entity]      │
│  [Approve] [Escalate] [Block Wallet]          │
└────────────────────────────────────────────────┘
```

#### Step 2: Review Risk Factors

**Analyze each risk component:**

1. **Transaction Velocity (10x normal)**
   - Normal: 2-3 transactions per week
   - Current: 20+ transactions in 1 hour
   - **Assessment:** Highly unusual

2. **Large Amounts ($2M total)**
   - Normal: $50K average per transaction
   - Current: $500K-$800K per transaction
   - **Assessment:** Significant increase

3. **New Counterparties (15 wallets)**
   - Normal: Same 5-10 known wallets
   - Current: 15 never-seen-before wallets
   - **Assessment:** Red flag

4. **Geographic Risk**
   - Some recipients in high-risk jurisdictions
   - **Assessment:** Moderate concern

#### Step 3: Review Related Checks

Click each related check to see full details:

**Pattern Analysis:**
- All transactions within 1-hour window
- All to unknown wallets
- All auto-escalated due to risk
- None have KYC verification for recipients

#### Step 4: Review Entity History

**Historical Context:**
- 6 months of clean history
- 23 previous transactions, all approved
- Normal pattern: $50K every 2 weeks
- Sudden change: 40x increase in activity

**Possible Scenarios:**

| Scenario | Probability | Indicators |
|----------|-------------|------------|
| **Legitimate bulk investment** | 60% | Entity is PE fund, bulk deployment common |
| **Account compromise** | 30% | Sudden pattern change, unknown wallets |
| **Money laundering** | 10% | High velocity to unverified recipients |

#### Step 5: Gather Additional Information

**Actions to Take:**

1. **Request Documentation**
   - Click **"Request Documentation"** button
   - Select required documents:
     - ✅ Proof of funds source
     - ✅ Investment agreements
     - ✅ Recipient KYC documents
     - ✅ Board approval (if required)
   - Add message:
     ```
     Please provide documentation for the recent large
     transactions totaling $2M within the last hour.
     We need to verify the source of funds and legitimacy
     of recipient entities.
     ```
   - Set deadline: 24 hours
   - Click **"Send Request"**

2. **Contact Entity**
   - Click **"Contact Entity"** button
   - Call registered phone number
   - Verify: "Did you authorize these transactions?"
   - Document conversation in notes

3. **Blockchain Analysis**
   - View recipient wallet history
   - Check if wallets are on any watchlists
   - Analyze transaction patterns

#### Step 6: Make Decision

**Based on investigation, choose action:**

**Option 1: Approve** (if legitimate)
- Click **"Approve"** button
- Add justification:
  ```
  Spoke with CFO (John Smith, verified via callback).
  Confirmed bulk deployment for new fund. Source of
  funds verified via bank statements. Recipients are
  qualified investors with KYC on file. PEP screening
  clear. Approving all 3 transactions.
  ```
- Transactions proceed
- Alert closed

**Option 2: Escalate** (if need senior review)
- Click **"Escalate"** button
- Select escalation level:
  - ⬆️ Senior Compliance Officer
  - ⬆️⬆️ Chief Compliance Officer
  - ⬆️⬆️⬆️ Legal/Executive
- Add notes:
  ```
  Requires executive approval due to amount ($2M) and
  pattern deviation. Awaiting documentation from entity.
  Recommend hold pending document review.
  ```
- Alert assigned to selected person
- Email notification sent

**Option 3: Block Wallet** (if fraud suspected)
- Click **"Block Wallet"** button
- **WARNING DIALOG:**
  ```
  ⚠️ WARNING: Blocking Wallet
  
  This action will:
  - Block all future transactions from this wallet
  - Add wallet to internal blocklist
  - Trigger regulatory reporting (if required)
  - Cannot be easily reversed
  
  Are you sure?
  
  Reason (required):
  [__________________________________________________]
  
  [Cancel] [Confirm Block]
  ```
- Enter reason:
  ```
  Unable to verify legitimacy. Entity not responding to
  contact attempts. Transaction pattern consistent with
  layering (money laundering). Blocking per AML policy.
  ```
- Click **"Confirm Block"**
- Wallet added to blocklist
- Transactions reversed/held
- Regulatory report filed (if required in jurisdiction)

#### Step 7: Document Investigation

**Investigation Log Auto-Generated:**

```
Investigation Timeline:

2:45 PM - Alert triggered (unusual pattern)
2:47 PM - Analyst opened investigation
2:50 PM - Reviewed risk factors and history
2:55 PM - Requested documentation from entity
3:00 PM - Attempted phone contact (no answer)
3:05 PM - Blockchain analysis completed
3:10 PM - Escalated to Senior Compliance Officer
3:15 PM - Investigation closed (pending escalation)

Actions Taken:
✅ Documentation requested (deadline: Mar 2, 2:55 PM)
✅ Phone contact attempted (voicemail left)
✅ Blockchain analysis completed
✅ Escalated to Senior Compliance Officer

Next Steps:
⏳ Awaiting documentation from entity
⏳ Awaiting senior officer review
⏳ Follow-up phone call scheduled (Mar 2, 9:00 AM)
```

**All actions logged in audit trail**

### 9.4 Alert Notifications

**Configure Alert Notifications:**

1. Go to: **Settings** > **Notifications**

2. **Notification Channels:**

   | Channel | Configuration | Use Case |
   |---------|---------------|----------|
   | **Email** | Add email addresses | Standard notifications |
   | **SMS** | Add phone numbers | Critical/urgent alerts |
   | **Slack** | Connect Slack workspace | Team collaboration |
   | **Microsoft Teams** | Connect Teams tenant | Enterprise integration |
   | **Webhook** | Custom API endpoint | System integration |
   | **In-App** | Enabled by default | Dashboard notifications |

3. **Notification Rules:**

   ```
   ┌────────────────────────────────────────────────┐
   │  Notification Rules                            │
   │                                                 │
   │  🔴 CRITICAL Alerts                            │
   │  ☑ Email (immediate)                           │
   │  ☑ SMS (immediate)                             │
   │  ☑ Slack (#compliance-critical)                │
   │  ☑ In-App (immediate)                          │
   │                                                 │
   │  🟠 HIGH Priority Alerts                       │
   │  ☑ Email (immediate)                           │
   │  ☐ SMS                                         │
   │  ☑ Slack (#compliance)                         │
   │  ☑ In-App (immediate)                          │
   │                                                 │
   │  🟡 MEDIUM Priority Alerts                     │
   │  ☑ Email (daily digest at 9 AM)               │
   │  ☐ SMS                                         │
   │  ☐ Slack                                       │
   │  ☑ In-App (batched)                            │
   │                                                 │
   │  🔵 LOW Priority Alerts                        │
   │  ☑ Email (weekly digest, Friday 5 PM)         │
   │  ☐ SMS                                         │
   │  ☐ Slack                                       │
   │  ☑ In-App (batched)                            │
   │                                                 │
   │  [Save Notification Settings]                  │
   └────────────────────────────────────────────────┘
   ```

4. **Quiet Hours:**
   - Configure no-notification periods
   - Example: 10 PM - 7 AM (except critical)

5. **Escalation Rules:**
   ```
   IF alert not acknowledged within 15 minutes
   THEN escalate to manager
   AND send SMS to on-call officer
   ```

### 9.5 Alert Analytics

**View Alert Metrics:**

Go to: **Real-Time Alerts** > **Analytics**

```
┌────────────────────────────────────────────────┐
│  📊 Alert Analytics - Last 30 Days             │
│                                                 │
│  Total Alerts: 437                             │
│  ├─ Critical: 3 (0.7%)                         │
│  ├─ High: 28 (6.4%)                            │
│  ├─ Medium: 156 (35.7%)                        │
│  └─ Low: 250 (57.2%)                           │
│                                                 │
│  Response Times (Average)                      │
│  ├─ Critical: 3.2 minutes                      │
│  ├─ High: 42 minutes                           │
│  ├─ Medium: 8.5 hours                          │
│  └─ Low: 3.2 days                              │
│                                                 │
│  Resolution                                     │
│  ├─ Resolved: 418 (95.6%)                      │
│  ├─ In Progress: 12 (2.7%)                     │
│  ├─ Escalated: 5 (1.1%)                        │
│  └─ Dismissed (false positive): 2 (0.5%)       │
│                                                 │
│  Top Alert Types                               │
│  1. Escalated Checks (38%)                     │
│  2. Unusual Patterns (22%)                     │
│  3. KYC Document Expiring (18%)                │
│  4. Large Transactions (12%)                   │
│  5. Sanctions Screening (5%)                   │
│  6. System Alerts (3%)                         │
│  7. Other (2%)                                 │
│                                                 │
│  [Export Report] [Download CSV]                │
└────────────────────────────────────────────────┘
```

---

## 10. Reporting & Analytics

### 10.1 Pre-Built Reports

**Access Reports:**

Click **"Reports & Analytics"** in left sidebar (📈)

**Available Report Templates:**

| Report Name | Description | Frequency | Export |
|-------------|-------------|-----------|--------|
| **Daily Compliance Summary** | All checks processed in last 24h | Daily | PDF, Excel |
| **Weekly Performance Report** | Metrics + trends | Weekly | PDF, Excel, PowerPoint |
| **Monthly Regulatory Report** | Compliance statistics for regulators | Monthly | PDF |
| **Jurisdiction Breakdown** | Checks by country/region | On-demand | Excel, CSV |
| **Risk Score Analysis** | Distribution + trends | On-demand | Excel, PDF |
| **Audit Trail Report** | Complete audit log | On-demand | PDF |
| **Workflow Performance** | Automation metrics | Weekly | Excel |
| **Alert Response Times** | SLA compliance | Monthly | PDF, Excel |

### 10.2 Generating a Report

**Step-by-Step: Generate Daily Compliance Summary**

#### Step 1: Select Report Template

1. Go to: **Reports & Analytics**
2. Click **"Daily Compliance Summary"** card

#### Step 2: Configure Report Parameters

```
┌────────────────────────────────────────────────┐
│  📊 Daily Compliance Summary Report            │
│                                                 │
│  Date Range:                                   │
│  [From:] [Mar 1, 2026 ▼]                      │
│  [To:] [Mar 1, 2026 ▼]                       │
│                                                 │
│  Filters (optional):                           │
│  [Jurisdiction:] [All ▼]                       │
│  [Status:] [All ▼]                             │
│  [Risk Level:] [All ▼]                         │
│                                                 │
│  Include Sections:                             │
│  ☑ Executive Summary                           │
│  ☑ Key Metrics                                 │
│  ☑ Risk Score Distribution                     │
│  ☑ Top 10 High-Risk Checks                    │
│  ☑ Jurisdiction Breakdown                      │
│  ☑ Workflow Performance                        │
│  ☑ Alert Summary                               │
│  ☐ Detailed Check List (adds 50+ pages)        │
│                                                 │
│  Format:                                       │
│  ◉ PDF   ○ Excel   ○ PowerPoint               │
│                                                 │
│  [Cancel] [Generate Report]                    │
└────────────────────────────────────────────────┘
```

#### Step 3: Generate Report

1. Click **"Generate Report"** button

2. **Progress Indicator:**
   ```
   Generating report...
   ⏳ Gathering data (3/7 steps complete)
   
   [█████████████░░░░░░░░░] 42%
   
   Estimated time: 15 seconds
   ```

3. **Report Ready:**
   ```
   ✅ Report Generated Successfully
   
   Daily Compliance Summary - Mar 1, 2026
   42 pages | PDF | 2.3 MB
   
   [Download Report] [Email Report] [Schedule Regular Delivery]
   ```

#### Step 4: Review Report

**Report Contents (Example):**

```
┌────────────────────────────────────────────────┐
│  DAILY COMPLIANCE SUMMARY                      │
│  March 1, 2026                                 │
│  Ableka Lumina Compliance Platform             │
├────────────────────────────────────────────────┤
│                                                 │
│  EXECUTIVE SUMMARY                             │
│  ────────────────────────────────────────────  │
│  Total Checks Processed: 127                   │
│  Approved: 89 (70%)                            │
│  Pending Review: 27 (21%)                      │
│  Rejected: 11 (9%)                             │
│                                                 │
│  Average Risk Score: 32.4 (Medium)             │
│  Critical Alerts: 2                            │
│  SLA Compliance: 94%                           │
│                                                 │
│  KEY METRICS                                   │
│  ────────────────────────────────────────────  │
│  Total Transaction Volume: $8.4M               │
│  Average Transaction: $66,141                  │
│  Largest Transaction: $850,000 (Approved)      │
│  Smallest Transaction: $5,000 (Approved)       │
│                                                 │
│  Processing Time:                              │
│  - Average: 2.8 seconds                        │
│  - Median: 2.1 seconds                         │
│  - 95th percentile: 5.2 seconds                │
│                                                 │
│  [Charts and detailed tables follow...]        │
└────────────────────────────────────────────────┘
```

### 10.3 Custom Report Builder

**Create Your Own Reports:**

#### Step 1: Start Custom Report

1. Go to: **Reports & Analytics** > **Custom Report Builder**
2. Click **"➕ New Custom Report"**

#### Step 2: Select Data Sources

**Available Data:**

| Data Source | Fields Available | Use Case |
|-------------|------------------|----------|
| **Compliance Checks** | All check data + risk scores | Main compliance analysis |
| **Alerts** | Alert history + response times | Alert performance |
| **Workflows** | Execution logs + metrics | Automation effectiveness |
| **Users** | Activity logs | Team performance |
| **Audit Trail** | All system actions | Compliance audit |
| **Jurisdictions** | Rules + application stats | Jurisdiction analysis |

**Example: Select "Compliance Checks"**

#### Step 3: Choose Metrics

**Metrics Builder:**

```
┌────────────────────────────────────────────────┐
│  Metrics Selection                             │
│                                                 │
│  Primary Metrics:                              │
│  ☑ Total Checks                                │
│  ☑ Average Risk Score                          │
│  ☑ Total Transaction Volume                    │
│  ☑ Approval Rate (%)                           │
│                                                 │
│  Breakdown By:                                 │
│  ☑ Jurisdiction                                │
│  ☑ Date (daily)                                │
│  ☐ Hour of day                                 │
│  ☑ Status                                      │
│  ☑ Risk Level                                  │
│                                                 │
│  Visualizations:                               │
│  ☑ Bar chart (checks by jurisdiction)         │
│  ☑ Line chart (risk scores over time)         │
│  ☑ Pie chart (status distribution)            │
│  ☐ Heat map                                    │
│  ☐ Scatter plot                                │
│                                                 │
└────────────────────────────────────────────────┘
```

#### Step 4: Apply Filters

**Filter Options:**

```
┌────────────────────────────────────────────────┐
│  Filters                                       │
│                                                 │
│  Date Range:                                   │
│  ◉ Last 7 days   ○ Last 30 days               │
│  ○ Last 90 days  ○ Custom range                │
│                                                 │
│  Jurisdiction:                                 │
│  ☑ AE   ☑ US   ☑ IN   ☑ SG   ☑ UK             │
│                                                 │
│  Risk Score:                                   │
│  [Min: 0] [Max: 100]                          │
│  Or:                                           │
│  ☐ Low (0-29)   ☐ Medium (30-69)   ☐ High (70+)│
│                                                 │
│  Status:                                       │
│  ☑ All   ☐ Approved   ☐ Pending   ☐ Rejected  │
│                                                 │
│  Amount Range:                                 │
│  [Min: $_______] [Max: $_______]              │
│                                                 │
└────────────────────────────────────────────────┘
```

#### Step 5: Customize Layout

**Report Layout Designer:**

```
┌────────────────────────────────────────────────┐
│  Report Layout                                 │
│                                                 │
│  [Drag & Drop Sections]                        │
│                                                 │
│  1. 📄 Title Page                              │
│  2. 📊 Executive Summary                       │
│  3. 📈 Key Metrics Cards                       │
│  4. 📊 Risk Score Trends (line chart)          │
│  5. 🌍 Jurisdiction Breakdown (bar chart)      │
│  6. 📋 Top 20 High-Risk Checks (table)         │
│  7. ⚠️ Alerts Summary                          │
│  8. 📝 Detailed Data Table                     │
│  9. 📎 Appendix                                │
│                                                 │
│  [Add Section ▼]                               │
│                                                 │
│  Preview: [Desktop ▼]                          │
│  [👁️ Preview Report]                           │
│                                                 │
└────────────────────────────────────────────────┘
```

#### Step 6: Save & Schedule

**Report Settings:**

```
┌────────────────────────────────────────────────┐
│  Report Settings                               │
│                                                 │
│  Report Name:*                                 │
│  [Weekly AE Compliance Summary_______________] │
│                                                 │
│  Description:                                  │
│  [Detailed weekly report for UAE jurisdiction  │
│   compliance checks_____________________________]│
│                                                 │
│  Format:                                       │
│  ◉ PDF   ○ Excel   ○ PowerPoint   ○ All       │
│                                                 │
│  Schedule (optional):                          │
│  Frequency: [Weekly ▼]                         │
│  Day: [Monday ▼]                               │
│  Time: [09:00 AM ▼]                            │
│  Recipients: [compliance@company.com___________]│
│                                                 │
│  ☑ Save as template for reuse                 │
│                                                 │
│  [Cancel] [Save] [Generate Now]                │
└────────────────────────────────────────────────┘
```

### 10.4 Dashboards & Data Visualization

**Interactive Analytics Dashboards:**

Go to: **Reports & Analytics** > **Dashboards**

**Dashboard Tiles:**

1. **Compliance Health Score** (0-100)
   - Overall system health
   - Based on: approval rate, alert response, SLA compliance
   - Color-coded: Green (80+), Yellow (60-79), Red (<60)

2. **Check Volume Trends**
   - Line chart showing checks per day (last 30 days)
   - Hover for exact numbers
   - Click to filter by that day

3. **Risk Score Heat Map**
   - Calendar view with color-coded risk levels
   - Darker red = higher average risk
   - Identify risky periods

4. **Jurisdiction Performance**
   - Bar chart ranking jurisdictions by volume
   - Click bar to drill down

5. **Top 10 High-Risk Entities**
   - Table with wallet addresses and risk scores
   - Click to view full profile

6. **Real-Time Metrics** (auto-refresh every 30 seconds)
   - Active checks being processed
   - Pending reviews count
   - Alerts awaiting response
   - System uptime

**Dashboard Customization:**

- **Add Widgets:** Click ➕ to add tiles
- **Rearrange:** Drag & drop tiles
- **Resize:** Drag tile corners
- **Filter:** Apply global filters to entire dashboard
- **Export:** Download dashboard as PDF/image
- **Share:** Generate shareable link

### 10.5 Exporting & Sharing Reports

**Export Options:**

1. **Download to Computer**
   - Click **"Download"** button
   - Choose format (PDF/Excel/CSV)
   - File saved to Downloads folder

2. **Email Report**
   - Click **"Email Report"** button
   - Enter recipient emails (comma-separated)
   - Optional message
   - Click **"Send"**

3. **Schedule Regular Delivery**
   - Click **"Schedule"** button
   - Configure frequency and recipients
   - Reports auto-generated and emailed

4. **Share Link**
   - Click **"Share Link"** button
   - Generate secure link (token-based)
   - Set expiration (1 day, 7 days, 30 days)
   - Copy link and share

5. **API Access**
   - Integrate reports into your systems
   - Endpoint: `GET /api/v1/reports/{report_id}`
   - Returns JSON data

---

## 11. System Settings

### 11.1 User Profile Settings

**Access Profile Settings:**

1. Click **User Menu** (top-right, 👤 icon)
2. Select **"Profile Settings"**

**Profile Configuration:**

```
┌────────────────────────────────────────────────┐
│  👤 Profile Settings                           │
│                                                 │
│  Personal Information                          │
│  ────────────────────────────────────────────  │
│  Full Name:*                                   │
│  [John Smith_________________________________] │
│                                                 │
│  Email:*                                       │
│  [john.smith@company.com_____________________] │
│  (Cannot be changed - contact admin)           │
│                                                 │
│  Phone Number:                                 │
│  [+1-555-123-4567_____________________________]│
│                                                 │
│  Role: Compliance Officer                      │
│  (Assigned by administrator)                   │
│                                                 │
│  Timezone:                                     │
│  [UTC+05:30 (India Standard Time) ▼]          │
│                                                 │
│  Language:                                     │
│  [English (US) ▼]                              │
│                                                 │
│  [Save Changes]                                │
└────────────────────────────────────────────────┘
```

**Two-Factor Authentication:**

```
┌────────────────────────────────────────────────┐
│  🔒 Two-Factor Authentication (2FA)            │
│                                                 │
│  Status: ❌ Disabled                           │
│                                                 │
│  ⚠️ Recommended: Enable 2FA for extra security │
│                                                 │
│  [Enable 2FA]                                  │
│                                                 │
│  Backup Codes:                                 │
│  ☐ Generate backup codes (for 2FA recovery)   │
│                                                 │
└────────────────────────────────────────────────┘
```

**Enabling 2FA:**

1. Click **"Enable 2FA"**
2. Scan QR code with authenticator app (Google Authenticator, Authy)
3. Enter 6-digit code to verify
4. Save backup codes in safe place
5. 2FA now required on every login

**Change Password:**

```
┌────────────────────────────────────────────────┐
│  🔑 Change Password                            │
│                                                 │
│  Current Password:*                            │
│  [••••••••••••••_____________________________] │
│                                                 │
│  New Password:*                                │
│  [••••••••••••••_____________________________] │
│  Password Strength: [████████░░] Strong        │
│                                                 │
│  Confirm New Password:*                        │
│  [••••••••••••••_____________________________] │
│                                                 │
│  [Update Password]                             │
└────────────────────────────────────────────────┘
```

### 11.2 Notification Preferences

**Configure Notifications:**

Go to: **Settings** > **Notifications**

```
┌────────────────────────────────────────────────┐
│  🔔 Notification Preferences                   │
│                                                 │
│  Email Notifications                           │
│  ────────────────────────────────────────────  │
│  ☑ Critical alerts (immediate)                 │
│  ☑ High priority alerts (immediate)            │
│  ☑ Medium priority alerts (daily digest)      │
│  ☐ Low priority alerts (weekly digest)        │
│  ☑ Workflow execution failures                 │
│  ☑ System maintenance notices                  │
│  ☐ Product updates & news                     │
│                                                 │
│  In-App Notifications                          │
│  ────────────────────────────────────────────  │
│  ☑ All compliance alerts                       │
│  ☑ Checks assigned to me                       │
│  ☑ Comments on my checks                       │
│  ☐ Weekly performance summary                  │
│                                                 │
│  SMS Notifications (additional charges apply)  │
│  ────────────────────────────────────────────  │
│  Phone: [+1-555-123-4567__________] [Verify]   │
│  ☑ Critical alerts only                        │
│  ☐ High priority alerts                        │
│                                                 │
│  Quiet Hours                                   │
│  ────────────────────────────────────────────  │
│  ☑ Enable quiet hours                          │
│  From: [10:00 PM ▼] To: [07:00 AM ▼]          │
│  (Critical alerts bypass quiet hours)          │
│                                                 │
│  [Save Preferences]                            │
└────────────────────────────────────────────────┘
```

### 11.3 System Configuration (Admin Only)

**Admin Access Required:**

Go to: **Settings** > **System Configuration**

**Jurisdiction Rules Management:**

```
┌────────────────────────────────────────────────┐
│  🌍 Jurisdiction Rules                         │
│                                                 │
│  Active Jurisdictions:                         │
│  ☑ AE (United Arab Emirates - Dubai)          │
│  ☑ US (United States - SEC)                   │
│  ☑ IN (India - SEBI)                          │
│  ☑ SG (Singapore - MAS)                       │
│  ☑ UK (United Kingdom - FCA)                  │
│  ☐ EU (European Union - MiFID II)             │
│  ☐ HK (Hong Kong - SFC)                       │
│                                                 │
│  [Edit Rules] [Add Jurisdiction] [Import YAML] │
│                                                 │
│  Rules Last Updated: Mar 1, 2026               │
│  [View Changelog]                              │
└────────────────────────────────────────────────┘
```

**API Integration Settings:**

```
┌────────────────────────────────────────────────┐
│  🔌 External API Integrations                  │
│                                                 │
│  KYC Provider (Ballerine):                     │
│  Status: ✅ Connected                          │
│  API Key: bal_••••••••••••1234                │
│  [Test Connection] [Update Key]                │
│                                                 │
│  AML Provider (Marble):                        │
│  Status: ✅ Connected                          │
│  API Key: mar_••••••••••••5678                │
│  [Test Connection] [Update Key]                │
│                                                 │
│  Sanctions Screening (Chainalysis):            │
│  Status: ✅ Connected (Public blockchain only) │
│  API Key: cha_••••••••••••9012                │
│  [Test Connection] [Update Key]                │
│                                                 │
│  LLM Provider (Grok 4.1):                      │
│  Status: ✅ Connected                          │
│  API Key: grok_••••••••••3456                 │
│  Model: grok-4.1-turbo                         │
│  [Test Connection] [Update Key]                │
│                                                 │
└────────────────────────────────────────────────┘
```

**Database Configuration:**

```
┌────────────────────────────────────────────────┐
│  🗄️ Database Settings                          │
│                                                 │
│  PostgreSQL Connection:                        │
│  Host: postgres:5432                           │
│  Database: compliance_db                       │
│  Status: ✅ Connected                          │
│  Pool Size: 20 connections                     │
│                                                 │
│  Redis Cache:                                  │
│  Host: redis:6379                              │
│  Status: ✅ Connected                          │
│  Memory Used: 142 MB / 512 MB                  │
│  Hit Rate: 87.3%                               │
│                                                 │
│  PGVector (AI Embeddings):                     │
│  Status: ✅ Enabled                            │
│  Vectors Stored: 12,456                        │
│  Dimensions: 1536                              │
│                                                 │
│  [View Database Stats] [Run Maintenance]       │
└────────────────────────────────────────────────┘
```

**Audit Log Settings:**

```
┌────────────────────────────────────────────────┐
│  📝 Audit & Compliance Logging                 │
│                                                 │
│  Audit Trail:                                  │
│  ☑ Log all user actions                        │
│  ☑ Log all compliance decisions                │
│  ☑ Log all system changes                      │
│  ☑ Log API requests                            │
│                                                 │
│  Retention Period:                             │
│  Audit Logs: [7 years ▼] (regulatory req.)     │
│  System Logs: [90 days ▼]                      │
│                                                 │
│  Compliance Reports:                           │
│  ☑ Auto-generate monthly regulatory reports    │
│  ☑ Archive all reports for 10 years            │
│                                                 │
│  [Export Audit Log] [View Settings]            │
└────────────────────────────────────────────────┘
```

---

## 12. Troubleshooting

### 12.1 Common Issues & Solutions

#### Issue 1: Dashboard Not Loading

**Symptoms:**
- Blank white page
- "Cannot connect to server" error
- Loading spinner never stops

**Solutions:**

**Solution A: Check Service Status**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr compliance
```

Expected: All services showing "(healthy)"

If any unhealthy:
```bash
docker compose restart <service-name>
```

**Solution B: Clear Browser Cache**
1. Press `Ctrl+Shift+Delete`
2. Select "Cached images and files"
3. Clear last 24 hours
4. Refresh page (`Ctrl+F5`)

**Solution C: Verify API Connectivity**
```bash
curl http://localhost:4000/api/health
```

Expected: `{"status":"healthy"}`

If failed: Check API Gateway logs
```bash
docker logs compliance-gateway --tail=50
```

**Solution D: Check Docker Network**
```bash
docker network inspect compliance-system_compliance-network
```

Verify all containers connected

---

#### Issue 2: Login Keeps Failing

**Symptoms:**
- "Invalid email/password" even with correct credentials
- Session expires immediately
- 401 Unauthorized errors

**Solutions:**

**Solution A: Verify Credentials**
- Email is case-sensitive
- Password is case-sensitive
- No extra spaces

**Solution B: Check JWT Secret**
```bash
# Verify JWT_SECRET is set in .env
cat c:\Users\Mange\work\ablk-compliance-tracker\compliance-system\.env | findstr JWT_SECRET
```

If empty or missing:
```bash
# Generate new secret
echo JWT_SECRET=$(openssl rand -base64 32) >> .env
docker compose restart compliance-gateway
```

**Solution C: Clear Cookies**
1. Open browser DevTools (`F12`)
2. Application tab > Cookies
3. Delete all cookies for localhost:4005
4. Try login again

**Solution D: Check Database Connection**
```bash
docker exec compliance-postgres psql -U postgres -d compliance_db -c "SELECT COUNT(*) FROM users;"
```

If error: Database connection issue (see Issue 7)

---

#### Issue 3: Compliance Check Stuck in "Processing"

**Symptoms:**
- Check submitted 5+ minutes ago
- Status still shows "🔄 Processing"
- No result returned

**Solutions:**

**Solution A: Check Agents Service**
```bash
docker logs compliance-agents --tail=100
```

Look for errors related to:
- External API failures (Ballerine, Marble, Chainalysis)
- LLM timeout
- Database connection

**Solution B: Check External API Status**
```bash
# Test Ballerine
curl https://api.ballerine.io/health

# Test Marble
curl https://api.getmarble.com/health
```

If external API down: Check will timeout and escalate automatically

**Solution C: Manually Resubmit Check**
1. Go to Compliance Checks
2. Find stuck check
3. Click **"Recheck"** button
4. System will retry with fresh call

**Solution D: Check AI Agent Queue**
```bash
docker exec compliance-redis redis-cli -p 6379 LLEN agent_queue
```

If queue too long (>100): Agents backlogged

Increase agent workers:
```bash
# Edit docker-compose.yml
# Set AGENT_WORKERS=5 (default is 2)
docker compose up -d compliance-agents
```

---

#### Issue 4: Alerts Not Appearing

**Symptoms:**
- No alerts in Real-Time Alerts page
- Known high-risk check submitted but no alert
- Notification email not received

**Solutions:**

**Solution A: Check Alert Rules**
1. Go to: Workflows > View Active Workflows
2. Verify alert workflows are **Active**
3. Check conditions are correct

**Solution B: Check Notification Settings**
1. Go to: Settings > Notifications
2. Verify email/notification channels enabled
3. Test: Click **"Send Test Notification"**

**Solution C: Check WebSocket Connection**
1. Open browser DevTools (`F12`)
2. Network tab > WS (WebSocket)
3. Look for ws://localhost:4005/ws
4. Should show "101 Switching Protocols"

If disconnected:
- Firewall blocking WebSocket
- Proxy server issue
- Refresh page to reconnect

**Solution D: Check Redis Queue**
```bash
docker exec compliance-redis redis-cli -p 6379 LLEN alerts_queue
```

If alerts stuck in queue: Redis issue

Restart Redis:
```bash
docker compose restart compliance-redis
```

---

#### Issue 5: Slow Performance / Timeout Errors

**Symptoms:**
- Dashboard takes >10 seconds to load
- Check submissions timeout
- Reports generation fails

**Solutions:**

**Solution A: Check System Resources**
```bash
docker stats
```

Look for:
- High CPU usage (>80%)
- High memory usage (>90%)
- Container restarts

If resource constrained:
```bash
# Increase Docker resource limits
# Docker Desktop > Settings > Resources
# RAM: 8 GB minimum (16 GB recommended)
# CPU: 4 cores minimum
```

**Solution B: Check Database Performance**
```bash
docker exec compliance-postgres psql -U postgres -d compliance_db -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

If tables too large: Run vacuum
```bash
docker exec compliance-postgres psql -U postgres -d compliance_db -c "VACUUM ANALYZE;"
```

**Solution C: Check Redis Cache Hit Rate**
```bash
docker exec compliance-redis redis-cli -p 6379 INFO stats | findstr hit
```

If hit rate <70%: Cache not effective

Clear and rebuild cache:
```bash
docker exec compliance-redis redis-cli -p 6379 FLUSHALL
```

**Solution D: Check Network Latency**
```bash
ping localhost
```

If high latency (>10ms): Network issue

Restart Docker network:
```bash
docker compose down
docker network prune
docker compose up -d
```

---

#### Issue 6: Export/Download Not Working

**Symptoms:**
- Export button does nothing
- Download starts but file is corrupt
- PDF generation fails

**Solutions:**

** A: Check Browser Download Settings**
1. Browser Settings > Downloads
2. Allow automatic downloads
3. Check Downloads folder not full

**Solution B: Try Different Format**
- If PDF fails, try Excel
- If Excel fails, try CSV
- CSV is most reliable

**Solution C: Reduce Report Size**
- Apply more filters
- Shorter date range
- Uncheck "Detailed Check List"

**Solution D: Check API Logs**
```bash
docker logs compliance-gateway | findstr "export\|download"
```

Look for errors

**Solution E: Manual Export via API**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/v1/reports/export?format=csv \
  > report.csv
```

---

#### Issue 7: Database Connection Errors

**Symptoms:**
- "Connection refused" errors
- "Database unavailable" messages
- Services can't start

**Solutions:**

**Solution A: Check PostgreSQL Container**
```bash
docker ps | findstr postgres
```

Should show: "(healthy)"

If unhealthy:
```bash
docker logs compliance-postgres --tail=50
```

**Solution B: Verify Database Credentials**
```bash
# Check .env file
cat .env | findstr DB_
```

Verify:
- DB_HOST=postgres (not localhost)
- DB_PORT=5432 (internal port, not 4432)
- DB_USER=postgres
- DB_PASSWORD=[correct password]
- DB_NAME=compliance_db

**Solution C: Test Database Connection**
```bash
docker exec compliance-postgres psql -U postgres -d compliance_db -c "SELECT version();"
```

If error: Database not initialized

Run initialization:
```bash
docker exec -i compliance-postgres psql -U postgres -d compliance_db < c:\Users\Mange\work\ablk-compliance-tracker\compliance-system\config\sql\init-database.sql
```

**Solution D: Check Database Disk Space**
```bash
docker exec compliance-postgres df -h
```

If disk full (>95%): Clean up old data
```bash
docker exec compliance-postgres psql -U postgres -d compliance_db -c "
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
VACUUM FULL;
"
```

---

#### Issue 8: Workflow Not Triggering

**Symptoms:**
- Workflow configured but never runs
- Expected action not happening
- No logs in workflow execution history

**Solutions:**

**Solution A: Verify Workflow Status**
1. Go to: Workflow Builder
2. Find your workflow
3. Check Status: Must be **Active** (not Draft/Disabled)

**Solution B: Test Workflow Conditions**
1. Open workflow
2. Click **"Test Workflow"**
3. Enter sample data that should match
4. Review test results

If conditions don't match:
- Review condition logic
- Check field values
- Adjust conditions

**Solution C: Check Workflow Logs**
1. Workflow Builder > Your Workflow
2. Click **"View Execution Logs"**
3. Look for errors

Common issues:
- "Condition not met" - Conditions too restrictive
- "Action failed" - External API issue (email, etc.)
- "Permission denied" - Assigned user doesn't have access

**Solution D: Check Action Configuration**
- Verify email addresses valid
- Test assigned user exists
- Verify webhook URL accessible

---

### 12.2 Error Messages Explained

| Error Code | Message | Cause | Solution |
|------------|---------|-------|----------|
| **400** | "Invalid wallet address format" | Malformed wallet address | Use full 0x... address (42 chars) |
| **401** | "Unauthorized" | Missing/invalid JWT token | Log in again |
| **403** | "Insufficient permissions" | User lacks required role | Contact admin for role upgrade |
| **404** | "Check not found" | Invalid check ID | Verify check ID correct |
| **422** | "Validation failed" | Required fields missing | Fill all required (*) fields |
| **429** | "Too many requests" | Rate limit exceeded | Wait 60 seconds, try again |
| **500** | "Internal server error" | Backend issue | Check logs, contact support |
| **502** | "Bad gateway" | Nginx can't reach API | Check compliance-gateway running |
| **503** | "Service unavailable" | Service down/maintenance | Check docker ps, wait for restart |
| **504** | "Gateway timeout" | Request took >30 seconds | External API slow, retry |

### 12.3 Getting Help

**Support Resources:**

1. **Documentation**
   - This user manual (comprehensive)
   - API documentation: http://localhost:4000/api/docs
   - Architecture docs: `/Planning docs/System Architecture/`

2. **In-App Help**
   - Click **?** icon (top-right) for context help
   - Tooltips on hover over fields
   - Inline validation messages

3. **Logs & Diagnostics**
   - Download system logs: Settings > System > Download Logs
   - Includes: API logs, agent logs, database logs

4. **Contact Support**
   - Email: support@ableka.com
   - Include:
     - Error message (exact text)
     - Steps to reproduce
     - Screenshots
     - System logs (if available)

5. **Community Forum** (if available)
   - Search existing questions
   - Post new questions
   - Share best practices

---

## 13. Best Practices

### 13.1 Compliance Officer Workflows

**Daily Routine:**
1. **Morning (9:00 AM)**
   - Review overnight alerts (critical first)
   - Check pending escalations
   - Prioritize by SLA deadline

2. **Throughout Day**
   - Process escalated checks within SLA
   - Respond to entity requests (documentation)
   - Monitor real-time alerts

3. **End of Day (5:00 PM)**
   - Generate daily summary report
   - Hand off urgent items to next shift
   - Update workflow configurations if needed

**Weekly Tasks:**
- Review workflow performance
- Analyze risk score trends
- Update jurisdiction rules (if regulations changed)
- Team sync on challenging cases

**Monthly Tasks:**
- Generate regulatory reports
- Review audit trails
- Update blocked wallet lists
- Compliance training review

### 13.2 Security Best Practices

**Access Control:**
- ✅ Use strong passwords (12+ characters)
- ✅ Enable 2FA for all users
- ✅ Log out when leaving computer
- ❌ Never share credentials
- ❌ Don't use "Remember Me" on shared computers

**Data Handling:**
- ✅ Download reports to secure locations
- ✅ Encrypt sensitive documents
- ✅ Delete local files after uploading
- ❌ Don't email PII externally
- ❌ Don't screenshot confidential data

**System Security:**
- ✅ Keep browser updated
- ✅ Use company VPN
- ✅ Report suspicious activity immediately
- ❌ Don't install unknown browser extensions
- ❌ Don't access from public Wi-Fi

### 13.3 Performance Optimization

**For Faster Dashboard:**
- Use filters to reduce data loaded
- Close unused browser tabs
- Clear cache weekly
- Use Chrome/Firefox (better performance)

**For Faster Reports:**
- Narrow date ranges
- Apply jurisdiction filters
- Uncheck "Detailed Check List"
- Schedule long reports overnight

**For Faster Compliance Checks:**
- Batch import instead of manual (for >10 checks)
- Use API integration for high volume
- Enable workflow automation

### 13.4 Data Quality

**Ensure High-Quality Submissions:**

- ✅ Double-check wallet addresses (copy-paste, don't type)
- ✅ Use full legal names (match official documents)
- ✅ Upload clear, legible documents (600 DPI minimum)
- ✅ Select correct jurisdiction (critical for compliance)
- ✅ Provide context in notes field

**Avoid Common Mistakes:**
- ❌ Abbreviated names ("J. Doe" instead of "John Michael Doe")
- ❌ Wrong jurisdiction (confusing entity location vs. transaction location)
- ❌ Blurry/cropped documents
- ❌ Missing required documents
- ❌ Incorrect currency selection

---

## 14. Frequently Asked Questions

### 14.1 General Questions

**Q: What browsers are supported?**
A: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. We recommend latest Chrome for best performance.

**Q: Can I access the dashboard on mobile?**
A: Yes, the dashboard is responsive. However, some features (workflow builder, reporting) work better on desktop.

**Q: How long are compliance checks stored?**
A: Audit logs: 7 years (regulatory requirement). System logs: 90 days. You can export and archive longer if needed.

**Q: Can I delete a compliance check?**
A: No. All checks are immutable for audit purposes. You can mark as "Dismissed" or "Overridden" but original record remains.

**Q: What happens if I lose my 2FA device?**
A: Use backup codes generated during 2FA setup. If lost, contact administrator to reset 2FA.

---

### 14.2 Compliance Check Questions

**Q: How long does a compliance check take?**
A: Average: 2-5 seconds. Maximum: 30 seconds (if external APIs slow).

**Q: What if external API (Ballerine, Marble) is down?**
A: System will timeout after 30 seconds and escalate check for manual review. You'll be notified.

**Q: Can I override an AI rejection?**
A: Depends on rejection reason:
- Sanctions match: ❌ No (legal requirement)
- Failed KYC: ✅ Yes (if documents provided)
- AML flags: ⚠️ Rare (requires executive approval)

**Q: How accurate is the AI risk scoring?**
A: 96%+ confidence for clear-cut cases. Medium-risk cases (30-69) always escalated to human review.

**Q: What jurisdictions are supported?**
A: Currently: AE (Dubai), US, India, Singapore, UK. More can be added via YAML configuration.

---

### 14.3 Workflow Questions

**Q: Can I have multiple workflows for the same trigger?**
A: Yes. Workflows run in priority order (High, Medium, Low). All matching conditions will execute.

**Q: What happens if workflow action fails (e.g., email)?**
A: System retries 3 times. If still fails, logs error and sends notification to admin. Check continues processing.

**Q: Can I test workflows without affecting real data?**
A: Yes. Use the "Test Workflow" feature with sample data. No real checks are modified.

**Q: How do I disable a workflow temporarily?**
A: Go to Workflow Builder, toggle Status to "Disabled". Re-enable anytime.

---

### 14.4 Alert Questions

**Q: Why didn't I receive an alert notification?**
A: Check:
1. Notification settings (Settings > Notifications)
2. Quiet hours configuration
3. Email spam folder
4. WebSocket connection (for in-app alerts)

**Q: Can I customize alert rules?**
A: Yes. Go to Workflow Builder and create custom alert workflows. Example: "Alert me when AE checks > $1M"

**Q: How do I clear old alerts?**
A: Alerts auto-archive after 90 days. To manually dismiss: Click alert > Dismiss (requires reason).

**Q: What's the difference between dismiss and resolve?**
A: 
- **Dismiss:** False positive, no action needed
- **Resolve:** Investigated and addressed

---

### 14.5 Reporting Questions

**Q: Can I schedule automated reports?**
A: Yes. When creating a report, click "Schedule". Choose frequency and recipients.

**Q: Report generation is slow. How to speed up?**
A: 
1. Narrow date range
2. Apply filters (jurisdiction, status)
3. Uncheck "Detailed Check List"
4. Export as CSV instead of PDF (faster)

**Q: Can I customize report templates?**
A: Yes. Use Custom Report Builder (Reports & Analytics > Custom Report Builder).

**Q: How do I share reports with auditors?**
A: 
1. Generate report
2. Click "Share Link"
3. Set expiration (e.g., 30 days)
4. Send link to auditor

---

### 14.6 Troubleshooting Questions

**Q: Dashboard won't load. What do I do?**
A: See [Section 12.1 - Issue 1: Dashboard Not Loading](#issue-1-dashboard-not-loading)

**Q: My check has been processing for 10 minutes. Is it stuck?**
A: Yes, likely stuck. See [Section 12.1 - Issue 3: Compliance Check Stuck](#issue-3-compliance-check-stuck-in-processing)

**Q: I forgot my password. How do I reset it?**
A: Click "Forgot Password" on login page. Follow email instructions. See [Section 4.3](#43-password-reset)

**Q: Export button doesn't work. Help?**
A: See [Section 12.1 - Issue 6: Export/Download Not Working](#issue-6-exportdownload-not-working)

---

## 15. Appendix

### 15.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+H` | Go to Home Dashboard |
| `Ctrl+K` | Go to Compliance Checks |
| `Ctrl+A` | Go to Real-Time Alerts |
| `Ctrl+W` | Go to Workflow Builder |
| `Ctrl+R` | Go to Reports & Analytics |
| `Ctrl+,` | Go to Settings |
| `Ctrl+N` | New Compliance Check |
| `Ctrl+S` | Save (when editing) |
| `Ctrl+F` | Search |
| `Esc` | Close modal/dialog |
| `Ctrl+/` | Show keyboard shortcuts help |

### 15.2 Glossary

| Term | Definition |
|------|------------|
| **KYC** | Know Your Customer - Identity verification process |
| **AML** | Anti-Money Laundering - Screening for financial crimes |
| **PEP** | Politically Exposed Person - High-risk individuals |
| **OFAC** | Office of Foreign Assets Control (US sanctions) |
| **SDN** | Specially Designated Nationals (sanctions list) |
| **Risk Score** | 0-100 numerical assessment of entity/transaction risk |
| **Escalation** | Routing check to human reviewer |
| **Jurisdiction** | Country/region with specific compliance rules |
| **Workflow** | Automated rule-based process |
| **SLA** | Service Level Agreement - Response time commitment |
| **Audit Trail** | Immutable log of all actions |
| **WebSocket** | Real-time bidirectional communication protocol |
| **RWA** | Real-World Asset – physical or financial asset represented on-chain |
| **PE** | Private Equity – privately held investment fund |
| **LP** | Limited Partner – investor in a PE fund |
| **GP** | General Partner – fund manager |
| **LPA** | Limited Partnership Agreement – legal document governing a PE fund |
| **PPM** | Private Placement Memorandum – offering document for private investments |
| **pe_fund_token** | Tokenized LP interest in a Private Equity fund |
| **Authenticity Score** | 0-100 score for document genuineness (100 = definitely authentic) |
| **Validity Score** | 0-100 score for asset genuineness (100 = definitely valid) |
| **Fraud Risk Score** | 0-100 score indicating probability of fraud (0 = no risk) |
| **Hash Integrity** | SHA-256 verification that a file has not been altered |
| **Ownership Chain** | Historical sequence of asset owners from oldest to current |

### 15.3 Jurisdictions Reference

**Currently Supported:**

| Code | Jurisdiction | Regulator | Key Rules |
|------|--------------|-----------|-----------|
| **AE** | UAE - Dubai | DFSA | Min fund size: 1M AED, PEP screening required |
| **US** | United States | SEC/FinCEN | Reg D, AML, PATRIOT Act |
| **IN** | India | SEBI | Min fund: 10L INR, UBO required |
| **SG** | Singapore | MAS | AML/CFT, accredited investor only |
| **UK** | United Kingdom | FCA | FCA handbook, FSMA, senior manager regime |

**Contact admin to add new jurisdictions**

### 15.4 Contact Information

**Technical Support:**
- Email: support@ableka.com
- Phone: +971-4-XXX-XXXX (9 AM - 6 PM GST)
- Slack: #ableka-support (if integrated)

**Compliance Questions:**
- Email: compliance@ableka.com
- Emergency: compliance-emergency@ableka.com

**System Status:**
- Dashboard: http://localhost:4005
- API Health: http://localhost:4000/api/health
- System Metrics: http://localhost:4001 (Grafana)

---

## Document Information

**Document Version:** 1.1  
**Last Updated:** March 3, 2026  
**Maintained By:** Ableka Lumina Documentation Team  
**Feedback:** docs@ableka.com  

---

**End of User Manual**

*Thank you for using Ableka Lumina Compliance Platform!*
