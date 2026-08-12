import { reactive } from 'vue';
import { authStore } from './auth.store';
import { defaultFarmId } from '../api/mock-data';

// UX-1D single source of truth for "which farm is the user currently looking at."
//
// Backend reality (confirmed against apps/backend/src/modules/mobile/mobile.service.ts and
// tenant.guard.ts before writing this): a non-PLATFORM_ADMIN user has exactly one assigned
// farm (User.farmId, a single scalar FK -- there is no multi-farm-per-user join table wired
// into any endpoint). GET /mobile/cockpit, /mobile/map, /mobile/alerts etc. all resolve their
// farmId server-side via resolveFarmId(), which *ignores* any other farmId a non-admin client
// requests and 403s if one is explicitly supplied. So for FARMER/MANAGER/ENGINEER, "current
// farm" is not really a multi-farm picker in this phase -- it is: (a) their own assigned farm
// by default, or (b) a farm temporarily revealed by opening a field that belongs to a
// different farm within their tenant (fieldDetail() is tenant-scoped, not farm-scoped, so this
// is a real, reachable case -- see FieldDetailPage.vue). A local farm id is UX state only; it
// is never treated as authorization, and an inaccessible farm is still rejected by the backend
// exactly as before (see api-error.ts's existing structured-error handling).
const STORAGE_KEY = 'agrios_current_farm';

type PersistedFarm = { farmId: string; userId: string };

function readPersisted(): PersistedFarm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.farmId === 'string' && typeof parsed.userId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function writePersisted(farmId: string, userId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ farmId, userId } satisfies PersistedFarm));
  } catch {
    // localStorage unavailable (private mode, quota) -- context still works for this session.
  }
}

function clearPersisted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const farmStore = reactive({
  currentFarmId: null as string | null,
  currentFarmName: null as string | null,

  // Initial-resolution precedence (deterministic, documented per UX-1D section 7):
  //   1. A persisted farm id, but ONLY if it still matches this exact authenticated user's own
  //      assigned farm (authStore.user.farmId) -- i.e. it is re-validated against real
  //      authorization data on every call, never trusted blindly.
  //   2. The user's own assigned farm from already-fetched auth data (login/me response).
  //   3. Otherwise: no farm resolved (cleared). Callers fall back to the mock/demo default
  //      farm only for continuity before auth resolves; that fallback lives at the call site
  //      (defaultFarmId), not here, so this store never fabricates authorization.
  // A resource (e.g. a field deep link) proving a *different* farm always wins over whatever
  // this resolved -- see setCurrentFarm(), which FieldDetailPage.vue calls directly to correct
  // context, and which is intentionally a separate, later-and-stronger step than this method.
  resolveInitialFarm() {
    const user = authStore.user;
    if (!user?.id) {
      this.clearCurrentFarm();
      return;
    }
    const persisted = readPersisted();
    if (persisted && persisted.userId === user.id && persisted.farmId === user.farmId) {
      this.setCurrentFarm(persisted.farmId, user.farm?.name ?? null);
      return;
    }
    if (user.farmId) {
      this.setCurrentFarm(user.farmId, user.farm?.name ?? null);
      return;
    }
    this.clearCurrentFarm();
  },

  setCurrentFarm(id: string, name?: string | null) {
    const isSameFarm = id === this.currentFarmId;
    this.currentFarmId = id;
    // Keep the existing name only if the farm id itself is unchanged and no new name was
    // supplied; a genuine farm change with no known name must not keep showing the old
    // farm's name against the new id.
    this.currentFarmName = name ?? (isSameFarm ? this.currentFarmName : null);
    const userId = authStore.user?.id;
    if (userId) writePersisted(id, userId);
  },

  clearCurrentFarm() {
    this.currentFarmId = null;
    this.currentFarmName = null;
    clearPersisted();
  },

  // For call sites that need a farmId immediately (including before auth/localStorage
  // resolution finishes, e.g. first paint) -- never fabricates authorization, just keeps the
  // existing mock/demo continuity that predates UX-1D.
  get currentFarmIdOrDefault() {
    return this.currentFarmId ?? defaultFarmId;
  }
});
