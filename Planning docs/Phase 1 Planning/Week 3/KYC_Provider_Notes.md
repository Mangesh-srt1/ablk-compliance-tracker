# KYC Provider Evaluation and Setup Notes

## Overview
Evaluated KYC providers for Indian and EU markets. Focused on integration ease, global coverage, and compliance with local regs.

## Indian/EU KYC Providers
- **Ballerine**: AI-powered KYC for global use. Supports eKYC, document verification. API: RESTful. Cost: $0.10 per check. Setup: API key from dashboard.
- **Jumio**: Global KYC with biometric verification. Supports India (Aadhaar) and EU (ID cards). API: SDK integration. Cost: $0.15 per check. Setup: Account creation, test environment.

## Evaluation Criteria
- **Accuracy**: Ballerine 95%, Jumio 98%.
- **Speed**: <5s for both.
- **Compliance**: GDPR for EU; DPDP for India.
- **Integration**: Both have Node.js SDKs.

## Setup Steps
1. Register on provider sites.
2. Obtain API keys.
3. Test basic calls (e.g., verify document).
4. Integrate into LangChain tools.

## Recommendations
Use Ballerine for cost-effectiveness; Jumio for high-accuracy needs.