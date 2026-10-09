import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cn, getURLForLanguage } from './utils';

describe('getURLForLanguage', () => {
    it('keeps english pages as they are', () => {
        assert.equal(getURLForLanguage('en', '/'), '/');
        assert.equal(getURLForLanguage('en', '/app'), '/app');
        assert.equal(getURLForLanguage('en', '/help/toolbar/poi'), '/help/toolbar/poi');
    });

    it('puts the language before the path of english pages', () => {
        assert.equal(getURLForLanguage('fr', '/app'), '/fr/app');
        assert.equal(getURLForLanguage('de', '/help/toolbar/poi'), '/de/help/toolbar/poi');
        // the home page of a language has no trailing slash
        assert.equal(getURLForLanguage('fr', '/'), '/fr');
    });

    it('replaces the language of translated pages', () => {
        assert.equal(getURLForLanguage('de', '/fr/app'), '/de/app');
        assert.equal(getURLForLanguage('es', '/fr/help/menu'), '/es/help/menu');
        assert.equal(getURLForLanguage('fr', '/fr/app'), '/fr/app');
        assert.equal(getURLForLanguage('de', '/fr'), '/de');
    });

    it('removes the language to go back to english', () => {
        assert.equal(getURLForLanguage('en', '/fr/app'), '/app');
        assert.equal(getURLForLanguage('en', '/fr/help/menu'), '/help/menu');
        assert.equal(getURLForLanguage('en', '/fr'), '/');
    });

    it('does not take a page for a language', () => {
        // `help` is not a language: the page is english
        assert.equal(getURLForLanguage('fr', '/help'), '/fr/help');
        // a language that is not offered is not one either
        assert.equal(getURLForLanguage('en', '/xx/app'), '/xx/app');
    });
});

describe('cn', () => {
    it('merges class names, the last tailwind class winning', () => {
        assert.equal(cn('p-2', 'p-4'), 'p-4');
        assert.equal(cn('text-sm', false && 'hidden', undefined, 'font-bold'), 'text-sm font-bold');
        assert.equal(cn(['a', { b: true, c: false }]), 'a b');
    });
});
