<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# which roles we should allow to tenant users

For a first version, keep roles **simple, tenant‑scoped, and least‑privilege**. A good starting set for your compliance system:

1. **TENANT_ADMIN**
    - Full admin for that tenant only.
    - Manage tenant settings, product enablement, API keys (view/rotate), user invites and role assignments.
    - Cannot see Abeleka‑global or other tenants’ data.[^1]
2. **COMPLIANCE_OFFICER**
    - Core user for your product.
    - View and manage alerts/cases, approve/reject reviews, file STR/SAR, edit compliance rules/policies within allowed bounds.[^2][^3]
    - Access KYC/AML views, transaction monitoring, audit trails for their tenant.
3. **COMPLIANCE_ANALYST**
    - Work on cases but with narrower powers.
    - View alerts and transactions, investigate, add notes, propose decisions, but cannot change global tenant settings or critical rules.[^2]
4. **OPERATOR / OPS_USER**
    - Day‑to‑day operational user.
    - Can view customer/asset status, trigger manual reviews, export reports relevant to operations, but no rule editing or API key access.
5. **READ_ONLY / VIEWER**
    - Purely read-only access for audits, management, and external reviewers.
    - View dashboards, cases, and reports, but cannot modify anything (no case status changes, no config edits).[^4][^5]

### How to model in tokens

For each login, issue roles **per tenant**:

```json
{
  "sub": "user_987",
  "tenant": "TENANT_123",
  "roles": ["TENANT_ADMIN", "COMPLIANCE_OFFICER"],
  "product_ids": ["prod_pe_001", "prod_comp_017"],
  "scope": "compliance:read compliance:write"
}
```

- Backend checks: “Is user `TENANT_ADMIN` or `COMPLIANCE_OFFICER` **for this tenant**?” before allowing admin/compliance actions.[^6][^1]
- You can later let big tenants define custom roles, but start with this fixed set so your authorization logic stays clean.
<span style="display:none">[^10][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://workos.com/blog/how-to-design-multi-tenant-rbac-saas

[^2]: https://synctera.com/post/compliance-operations-roles-responsibilities-in-bank-fintech-partnerships

[^3]: https://relevant.software/blog/fintech-compliance/

[^4]: https://help.sap.com/docs/Agent_Compliance/6d5b509c1d5841119173f30d0590a0bd/f1b4e024137747ca9c3243705edd4e71.html?version=2406

[^5]: https://help.coreview.com/operators-get-started/operators-and-user-roles

[^6]: https://www.descope.com/blog/post/rbac-providers-b2b-saas

[^7]: https://learn.microsoft.com/en-us/azure/service-health/admin-access-reference

[^8]: https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/permissions-reference

[^9]: https://www.coreview.com/blog/the-definitive-guide-to-microsoft-365-tenant-administration-management

[^10]: https://www.withum.com/resources/a-breakdown-of-microsoft-365-admin-roles-responsibilities-previously-office-365-admin-roles/

