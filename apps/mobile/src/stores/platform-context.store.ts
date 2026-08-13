import { reactive } from 'vue';

// UX-1H: transient, in-memory-only UI state for SUPER_ADMIN's Platform Mode tenant/farm picker.
// Deliberately NOT persisted to localStorage -- it is scratch state for the picker widget and
// for labeling the currently-active tenant once Farm Operation Mode is entered, never an
// authorization source and never a competing "current context" store. The one canonical
// operational context remains farmStore (UX-1D); this store only ever tracks which TENANT the
// currently-selected/active farm belongs to, since farmStore itself intentionally stays
// farm-operation-scoped and is not overloaded with platform tenant-administration concepts
// (see UX-1H section 14/15). Resetting on every page load (no persistence) trivially satisfies
// cross-user isolation -- there is nothing here that could leak between sessions.
export const platformContextStore = reactive({
  selectedTenantId: null as string | null,
  selectedTenantName: null as string | null,

  selectTenant(id: string | null, name?: string | null) {
    this.selectedTenantId = id;
    this.selectedTenantName = id ? (name ?? this.selectedTenantName) : null;
  },

  clear() {
    this.selectedTenantId = null;
    this.selectedTenantName = null;
  }
});
