# Permission System - Quick Reference

## Multi-Value Permissions

### policeYakalamaSecenekleri

**Values:**
- `'0'` = No control - Save all policies
- `'1'` = Soft control - Mark but save if no agency
- `'2'` = Hard control - Reject if no agency

**Frontend Check:**
```javascript
if (hasPoliceYakalamaPermission()) {
  // User has access to captured policies page
}
```

**Usage:**
- Menu visibility: `'a[href*="captured.html"]': 'policeYakalamaSecenekleri'`
- Page access: `if (!hasPoliceYakalamaPermission()) { redirect }`
- Dashboard card: `.dashboard-captured-card`

---

### gorebilecegiPolicelerveKartlar

**Values:**
- `'1'` = Admin - See all company policies (FirmaId filter)
- `'2'` = Editor - See branch policies (SubeId filter)
- `'3'` = Viewer - See own policies only (UyeId filter)
- `'4'` = None - No access (empty result)

**Frontend Check:**
```javascript
if (hasViewPermission()) {
  // User has access to view policies
}
```

**Usage:**
- Menu visibility: `'a[href*="my-policies.html"]': 'gorebilecegiPolicelerveKartlar'`
- Page access: `if (!hasViewPermission()) { redirect }`
- Dashboard: `'a[href*="index.html"]': 'gorebilecegiPolicelerveKartlar'`

---

## Adding New Multi-Value Permissions

**Step 1: Create check function in config.js**
```javascript
/**
 * Description of permission
 * @returns {boolean}
 */
function hasMyCustomPermission() {
  const permissions = APP_CONFIG.PERMISSIONS.getSync();
  const value = permissions?.myCustomPermission;
  // Define which values are valid
  return value === '1' || value === '2';
}
```

**Step 2: Update applyPermissions()**
```javascript
if (permission === 'myCustomPermission') {
  hasAccess = hasMyCustomPermission();
} else if (permission === 'policeYakalamaSecenekleri') {
  // ...
}
```

**Step 3: Add menu rule**
```javascript
const menuRules = {
  'a[href*="my-page.html"]': 'myCustomPermission',
  // ...
};
```

**Step 4: Use in page**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  if (!hasMyCustomPermission()) {
    showToast('Bu sayfaya erişim yetkiniz yok', 'error');
    setTimeout(() => window.location.href = '../../index.html', 1500);
    return;
  }
  // ...
});
```

---

## Standard Single-Value Permissions

For permissions that use `'1'` = true, `'0'` or missing = false:

```javascript
// Use the standard hasPermission() function
if (hasPermission('policeDuzenleyebilsin')) {
  // User can edit policies
}
```

**Menu rule:**
```javascript
'a[href*="add-manual.html"]': 'policeDuzenleyebilsin',
```

**Page access:**
```javascript
requirePermission('policeDuzenleyebilsin');
```

---

## Testing Permissions in Console

```javascript
// Get current permissions
const perms = APP_CONFIG.PERMISSIONS.getSync();
console.table(perms);

// Test specific permission
console.log('policeYakalamaSecenekleri:', perms?.policeYakalamaSecenekleri);
console.log('Can access?', hasPoliceYakalamaPermission());

// Clear cache and reload
APP_CONFIG.PERMISSIONS.invalidate();
await APP_CONFIG.PERMISSIONS.get();
```

---

## Common Pitfalls

❌ **Don't use hasPermission() for multi-value permissions:**
```javascript
// WRONG - Only checks for '1'
if (hasPermission('policeYakalamaSecenekleri')) { }
```

✅ **Use dedicated function:**
```javascript
// CORRECT
if (hasPoliceYakalamaPermission()) { }
```

❌ **Don't forget to update both menu rules AND page checks:**
```javascript
// WRONG - Menu visible but page blocked
menuRules: { /* no rule */ }
page: requirePermission('myPermission')
```

✅ **Update both:**
```javascript
// CORRECT
menuRules: { 'a[href*="page.html"]': 'myPermission' }
page: if (!hasMyPermission()) { redirect }
```

---

## Permission Value Lifecycle

```
1. Database (muhasebe_yetkiler table)
   ↓
2. Backend (Entity → JWT claim)
   ↓
3. Frontend (localStorage cache)
   ↓
4. Permission check function
   ↓
5. UI rendering
```

**Cache TTL:** 5 minutes

**Clear cache:**
```javascript
APP_CONFIG.PERMISSIONS.invalidate();
```

**Force refresh:**
```javascript
await APP_CONFIG.PERMISSIONS.fetchFromApi();
```
