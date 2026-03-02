<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Another doubt - Rt now Token Buy / Sell should happen via custodian (Platform owner). In case if we decide trading to happen bypassing custodian, what are the implications. One thing i can sense is foul intention of lets company x transfer tokens to company y and company y sell those on the platform and uses fiat to commit crime, havala, trafficing , epstein like things? what else you can think of

**Bypassing the custodian for direct token buy/sell (P2P trading) introduces significant risks in your permissioned PE/RWA platform.** While it enhances decentralization, it weakens oversight in a regulated space like real estate tokenization.[^1][^2]

## Compliance Risks

Without a custodian, KYC/AML checks become harder, violating regulations like India's PMLA or SEBI rules for security tokens.[^3][^4]
P2P transfers enable layering illicit funds across wallets, complicating traceability and exposing the platform to fines.[^5][^3]
In Hyperledger Besu networks, permissioning helps but can't fully replace centralized verification for transfers.[^6]

## Illicit Activity Vectors

Your scenario—Company X transfers tokens to Y, who sells for fiat—is classic: enables hawala-style laundering, terrorism financing, or trafficking by converting dirty fiat via clean token sales.[^3][^5]
Other threats include sanctions evasion (e.g., transferring to screened entities), tax evasion through unreported gains, and ransomware proceeds mixing.[^5][^3]
Phishing or insider collusion could lead to unauthorized transfers mimicking legitimate P2P trades.[^7][^2]

## Operational Concerns

Counterparty risk rises without custody: defaults, insolvencies, or off-chain asset mismatches go unchecked.[^2][^1]
Users bear full key management responsibility, amplifying losses from hacks, lost keys, or errors—no recourse like custodial insurance.[^7][^2]
Liquidity fragments without centralized order matching, and smart contract bugs become single points of failure.[^8][^1]

## Mitigation Strategies

Retain permissioned access in Besu with on-chain transfer restrictions (e.g., ERC-1400 compliance hooks).[^6]
Use oracles for real-time AML screening on transfers and require fiat ramps to enforce KYC.[^3]
Hybrid model: Allow P2P but route settlements through the platform for monitoring, balancing usability and safety.[^4]
<span style="display:none">[^10][^9]</span>

<div align="center">⁂</div>

[^1]: https://aurum.law/newsroom/Real-World-Assets-in-DeFi

[^2]: https://assetlink.substack.com/p/chapter-35-custodial-vs-non-custodial

[^3]: https://framework.amltrix.com/techniques/T0134.001

[^4]: https://www.linkedin.com/pulse/guide-aml-compliance-peer-to-peer-p2p-cryptocurrency-platforms-9bedf

[^5]: https://affiniax.com/blog/hawala-financial-crimes-aml-compliance/

[^6]: https://www.kaleido.io/blockchain-blog/private-transactions-on-blockchain-with-hyperledger-besu-and-orion

[^7]: https://learn.xrpl.org/lesson/security-custody-and-risks-in-rwa-tokenization/

[^8]: https://www.rwa.io/post/rwa-vs-security-tokens-what-to-choose

[^9]: https://in.tradingview.com/chart/TCS/L9O2i116-Tokenized-Real-World-Assets-RWA/

[^10]: https://zodia-custody.com/getting-real-exploring-real-world-asset-tokenisation-in-practice/

