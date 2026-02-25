# AML Provider Evaluation and Setup Notes

## Overview
Evaluated AML/sanctions providers for global screening. Focused on OFAC, EU sanctions, and crypto AML.

## AML/Sanctions Providers
- **Marble**: AML scoring for fintech. Integrates OFAC, EU lists. API: GraphQL. Cost: $0.20 per query. Setup: API token.
- **Chainalysis**: Crypto AML with sanctions screening. Supports Ethereum, etc. API: REST. Cost: $0.50 per tx. Setup: Enterprise account.

## Evaluation Criteria
- **Coverage**: Marble global; Chainalysis crypto-focused.
- **Accuracy**: Both >90% for sanctions.
- **Real-Time**: Yes for both.
- **Compliance**: FATF standards.

## Setup Steps
1. Sign up for accounts.
2. Get API credentials.
3. Test AML scoring (e.g., entity risk).
4. Integrate into agent tools.

## Recommendations
Marble for general AML; Chainalysis for blockchain.