import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultFileName } from './default-file-name';

describe('default file name', () => {
    it('is the default name when there is no other file with it', () => {
        assert.equal(defaultFileName('New file', []), 'New file');
        assert.equal(defaultFileName('New file', ['Morning ride', 'track']), 'New file');
    });

    it('is numbered when other files have the default name', () => {
        assert.equal(defaultFileName('New file', ['New file']), 'New file 2');
        assert.equal(defaultFileName('New file', ['New file', 'New file 2']), 'New file 3');
    });

    it('goes after the highest number', () => {
        assert.equal(defaultFileName('New file', ['New file 4', 'New file']), 'New file 5');
        // a number that was freed is not used again
        assert.equal(defaultFileName('New file', ['New file', 'New file 3']), 'New file 4');
        // the numbered ones count even if the first one was renamed
        assert.equal(defaultFileName('New file', ['New file 2']), 'New file 3');
    });

    it('ignores the names that only look like it', () => {
        assert.equal(defaultFileName('New file', ['New file copy', 'New files 3']), 'New file');
        assert.equal(
            defaultFileName('New file', ['New file 2b', 'New file 0', 'New file -3']),
            'New file'
        );
        assert.equal(defaultFileName('New file', ['New file ', 'New file  2']), 'New file');
        assert.equal(defaultFileName('New file', ['my New file']), 'New file');
    });

    it('works with any language', () => {
        assert.equal(defaultFileName('Nouveau fichier', ['Nouveau fichier']), 'Nouveau fichier 2');
        assert.equal(defaultFileName('新文件', ['新文件', '新文件 2']), '新文件 3');
        // the default name of another language is just a name
        assert.equal(
            defaultFileName('Nouveau fichier', ['New file', 'New file 2']),
            'Nouveau fichier'
        );
    });
});
