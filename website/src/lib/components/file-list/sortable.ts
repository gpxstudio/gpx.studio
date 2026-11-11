import Sortable, { MultiDrag } from 'sortablejs';

// The ESM build leaves out the MultiDrag plugin. Mounting it twice throws, so it is done here
// rather than in a module that hot reloading runs again.
Sortable.mount(new MultiDrag());

export default Sortable;
