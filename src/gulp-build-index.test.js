/* eslint-env jest */
import {readFileSync} from 'fs';
import {safeLoad} from 'js-yaml';
import {join, resolve, basename} from 'path';
import through2 from 'through2';
import es from 'event-stream';
import Vinyl from 'vinyl';
import buildIndex from './index';

// Set up a few virtual files to test on
const TEST_DATA = safeLoad(readFileSync(
  join(__dirname, '__test-data__/test-files.yml')
));

/**
 * Retrieve a stream of virtual files (specified in `test-files.yml`) based
 * on the fileset name.
 */
function getTestFiles(filesetName) {
  const fileset = TEST_DATA[filesetName];
  return es.readArray(fileset.files.map((file) => {
    const options = Object.assign({}, file, {
      cwd: fileset.cwd || fileset.base,
      base: fileset.base,
      path: resolve(fileset.base, file.path),
      contents: new Buffer(file.contents),
    });
    return new Vinyl(options);
  }));
}

const streamAsPromise = (stream) => new Promise((ok, fail) => {
  let count = 0;
  stream.on('data', () => {
    count = count + 1;
  });
  stream.on('end', () => ok()).on('error', (err) => fail(err));
});

const fullTextIndexer = (file, emit, done) => {
  const contents = file.contents.toString();
  contents.split(' ')
    .map((w) => w.replace(/[^a-z]/gi, '').toLowerCase())
    .filter(Boolean)
    .forEach((word) => emit(word, 1));
  done();
};

const keywordIndexer = (file, emit, done) => {
  const keywords = file.frontMatter.keywords;
  const fileBasename = basename(file.path);
  keywords.forEach((keyword) => emit(keyword, fileBasename));
  done();
};

describe('gulp-build-index', () => {
  it('should handle full-text indexing', () =>
    // Not sure if full-text indexing with this project is a good idea; might
    // run out of memory since I didn't bother trying to optimize it at all.
    // Here goes nothing...
    streamAsPromise(getTestFiles('sampleMdDocs')
      .pipe(buildIndex('fullText', fullTextIndexer))
      .pipe(through2.obj((file, enc, done) => {
        expect(typeof file.lookupFullText).toBe('function');
        const words = file.allIndexedFullText().sort();
        expect(file.lookupFullText('foo')).toHaveLength(5);
        expect(words).toMatchSnapshot('full-text words, sorted');
        done();
      })))
  );
  it('should handle keyword indexing', () =>
    streamAsPromise(getTestFiles('docsWithKeywords')
      .pipe(buildIndex('keywords', keywordIndexer))
      .pipe(through2.obj((file, enc, done) => {
        expect(typeof file.lookupKeywords).toBe('function');
        const words = file.allIndexedKeywords().sort();
        expect(file.lookupKeywords('kitchen').sort())
          .toMatchSnapshot('kitchen keywords');
        expect(words).toMatchSnapshot('all keywords, sorted');
        done();
      })))
  );
});
