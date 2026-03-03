<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# should it also include product id in scope?

Including product context in auth is a good idea, but **don’t overload `scope` with product IDs.** Use separate, structured claims.

### Recommended pattern

- Keep **`scope`** for *capabilities* (verbs/permissions), e.g.:
    - `pe:read`, `pe:write`, `compliance:read`, `compliance:write`.
- Add **dedicated claims** for product info:
    - `tenant`: `"TENANT_123"`
    - `products`: `["PE", "COMPLIANCE"]` or objects with ids:
        - `product_ids`: `["prod_pe_001", "prod_comp_017"]`
    - Optionally per‑product roles/limits in a nested claim.

Example:

```json
{
  "sub": "user_987",
  "tenant": "TENANT_123",
  "product_ids": ["prod_pe_001", "prod_comp_017"],
  "scope": "pe:read compliance:read"
}
```

Your services then:

- Use `scope` to decide *what* actions are allowed.
- Use `tenant` + `product_ids` to decide *which* products/resources this token can touch.

