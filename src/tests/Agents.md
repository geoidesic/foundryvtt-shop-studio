
**Required Global Mocks**:
```javascript
// FoundryVTT globals
global.game = {
  settings: { get: vi.fn((module, key) => /* return test values */) },
  i18n: { localize: vi.fn((key) => key) }
};
global.ui = { notifications: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } };
global.Hooks = { call: vi.fn(), on: vi.fn(), once: vi.fn() };
global.window = global;
global.Actor = { create: vi.fn() };
global.window.GAS = { log: { d: vi.fn(), w: vi.fn(), e: vi.fn() } };
```

**Required Store Mocks**:
- Do not import svelte stores into tests, mock them instead
```javascript
const mockWritable = (value) => ({ set: vi.fn(), update: vi.fn(), subscribe: vi.fn() });
const mockDerived = (stores, fn) => ({ set: vi.fn(), update: vi.fn(), subscribe: vi.fn() });
vi.mock('svelte/store', () => ({ writable: mockWritable, derived: mockDerived, get: mockGet }));
```

**Complete Finity Mock** - CRITICAL for WorkflowStateMachine tests:
```javascript
vi.mock('finity', () => {
  const mockFsm = { handle: vi.fn(), getCurrentState: vi.fn(() => 'idle'), start: vi.fn() };
  const mockFinity = {
    configure: vi.fn(() => mockFinity), initialState: vi.fn(() => mockFinity),
    state: vi.fn(() => mockFinity), on: vi.fn(() => mockFinity),
    transitionTo: vi.fn(() => mockFinity), withCondition: vi.fn(() => mockFinity),
    onEnter: vi.fn(() => mockFinity), do: vi.fn(() => mockFinity),
    onSuccess: vi.fn(() => mockFinity), onFailure: vi.fn(() => mockFinity),
    start: vi.fn(() => mockFsm)
  };
  return { default: mockFinity };
});
```

**Required Module Mocks** for WorkflowStateMachine dependency chain:
```javascript
vi.mock('~/src/stores/goldChoices', () => ({ totalGoldFromChoices: mockWritable(0) }));
vi.mock('~/src/stores/storeDefinitions', () => ({ goldRoll: mockWritable(0) }));
vi.mock('~/src/lib/workflow.js', () => ({ handleAdvancementCompletion: vi.fn() }));
vi.mock('~/src/helpers/AdvancementManager', () => ({ destroyAdvancementManagers: vi.fn() }));
vi.mock('~/src/helpers/Utility', () => ({ /* all utility functions as vi.fn() */ }));
```