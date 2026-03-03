/**
 * TenantBadge Component
 * Reads the JWT from localStorage, decodes it, and renders
 * the authenticated user's email, tenant, and product list.
 */

import React from 'react';
import { TokenClaims } from '../services/authAPI';
import '../styles/TenantBadge.css';

interface TenantBadgeProps {
  claims: TokenClaims;
  onLogout: () => void;
}

const PRODUCT_COLORS: Record<string, string> = {
  PE: '#7c3aed',
  COMPLIANCE: '#0e7490',
  REPORTING: '#047857',
  AML: '#b45309',
  KYC: '#be185d',
};

function productColor(product: string): string {
  return PRODUCT_COLORS[product.toUpperCase()] ?? '#64748b';
}

const TenantBadge: React.FC<TenantBadgeProps> = ({ claims, onLogout }) => {
  const displayName = claims.email || claims.sub || 'Unknown';
  const tenant = claims.tenant;
  const products = claims.products ?? [];
  const role = claims.role;

  return (
    <div className="tenant-badge">
      <div className="tenant-badge-info">
        <span className="tenant-badge-user" title={displayName}>
          {displayName}
        </span>
        {tenant && (
          <span className="tenant-badge-tenant" title={`Tenant: ${tenant}`}>
            🏢 {tenant}
          </span>
        )}
        <span className="tenant-badge-role">{role}</span>
      </div>

      {products.length > 0 && (
        <div className="tenant-badge-products">
          {products.map((p) => (
            <span
              key={p}
              className="product-chip"
              style={{ backgroundColor: productColor(p) }}
              title={`Product: ${p}`}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      <button className="tenant-badge-logout" onClick={onLogout} title="Sign out">
        Sign out
      </button>
    </div>
  );
};

export default TenantBadge;
