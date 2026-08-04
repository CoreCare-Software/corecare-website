-- CoreCare Platform 1.5.0 - current product catalogue versions
-- URLs remain owner-configured because they must match real deployed origins.
UPDATE platform_products SET current_version='1.5.0', status='live', updated_at=CURRENT_TIMESTAMP WHERE code='PLATFORM';
UPDATE platform_products SET current_version='1.28.1', status='live', updated_at=CURRENT_TIMESTAMP WHERE code='CARE';
UPDATE platform_products SET current_version='1.3.0', status='development', updated_at=CURRENT_TIMESTAMP WHERE code='POS';
UPDATE platform_products SET current_version='0.7.0', status='development', updated_at=CURRENT_TIMESTAMP WHERE code='GARAGE';
UPDATE platform_products SET current_version='1.0.0', status='development', updated_at=CURRENT_TIMESTAMP WHERE code='CAMPSITE';
UPDATE platform_products SET current_version='0.6.0', status='development', updated_at=CURRENT_TIMESTAMP WHERE code='FINANCE';
