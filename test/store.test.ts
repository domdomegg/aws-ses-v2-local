import {test, expect} from 'vitest';
import {getStoreReadonly} from '../src/store';

test('store.emails starts off empty', () => {
	expect(getStoreReadonly().emails).toHaveLength(0);
});
