// routes/tag-groups.js clean(): what a save of the tag lists may contain
const test = require('node:test');
const assert = require('node:assert/strict');
const { clean, DEFAULT_GROUPS } = require('../routes/tag-groups');

test('tag lists: tags written as all tags are, unknown categories dropped, empty lists dropped', () => {
    assert.deepEqual(clean([
        { label: ' Ancestry ', categories: ['characters', 'nonsense'], tags: ['Warforged', 'warforged', 'Firbold'] },
        { label: 'Empty', categories: ['characters'], tags: [] },
    ]), [{ label: 'Ancestry', categories: ['characters'], tags: ['warforged', 'firbolg'] }]);
});

test('tag lists: a list needs a name and a category', () => {
    assert.throws(() => clean([{ label: '', categories: ['characters'], tags: ['x'] }]), /name/);
    assert.throws(() => clean([{ label: 'Age', categories: [], tags: ['child'] }]), /category/);
    assert.throws(() => clean('nope'), /list/);
});

test('the default lists are valid as they are', () => assert.deepEqual(clean(DEFAULT_GROUPS), DEFAULT_GROUPS));
