import store from '../src/store';

test('store.emails starts off empty', () => {
  expect(store.emails).toHaveLength(0);
});
