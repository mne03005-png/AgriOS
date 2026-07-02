$BaseUrl = $env:AGRIOS_API_URL
if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000/api/v1" }

Write-Host "AgriOS P12.1 Tenant Isolation Check"
Write-Host "BaseUrl: $BaseUrl"
Write-Host ""
Write-Host "1. Prepare tenant A token, tenant B token, and PLATFORM_ADMIN token."
Write-Host "2. Use tenant A token to access tenant B data. Expected: 403."
Write-Host "curl -H `"Authorization: Bearer <tenantA_token>`" `"$BaseUrl/mobile/cockpit?farmId=farm_b&tenantId=tenant_b`""
Write-Host ""
Write-Host "3. Use PLATFORM_ADMIN token to access tenant B data. Expected: 200 and AuditEvent cross_tenant_access."
Write-Host "curl -H `"Authorization: Bearer <platform_admin_token>`" `"$BaseUrl/mobile/cockpit?farmId=farm_b&tenantId=tenant_b`""
Write-Host ""
Write-Host "4. Unauthenticated non-demo access. Expected: 403 on guarded modules."
Write-Host "curl `"$BaseUrl/audit/events?tenantId=tenant_b`""
Write-Host ""
Write-Host "5. Demo fallback. Expected: 200 or mock/demo response."
Write-Host "curl `"$BaseUrl/mobile/cockpit?farmId=demo`""
