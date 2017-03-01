# gulp-build-index

Build an index from source files, then use it downstream.

## Quick start

```bash
npm install --save-dev gulp-build-index
# or: yarn add --dev gulp-build-index
```

```js
const buildIndex = require('gulp-build-index');
const buffer = require('gulp-buffer');
const reduce = require('stream-reduce');
const source = require('vinyl-source-stream');
const path = require('path');

// Index all of the passed-in markdown files, then create a
// table of contents when all files have been read.
gulp.task('tableOfContents', () =>
  gulp.src('docs/**/*.md')
    // For each file seen, store the file path as the key and the
    // file's basename as the value.
    .pipe(buildIndex('contents', (file, emit, done) => {
      const basename = path.basename(file.path);
      const relativePath = path.relative(file.base, file.path);
      emit(relativePath, basename);
      done();
    }))
    // `reduce` only emits a single event when the stream ends.
    .pipe(reduce((contents, file) => {
      if (contents) return contents;
      return new Buffer(
        file.allIndexedContents()
          .sort()
          .map(filepath => {
            const name = file.lookupContents(filepath);
            return `- [${name}](${filepath})`;
          })
        );
    }, null))
    .pipe(source('table-of-contents.md'))
    .pipe(gulp.dest('dist/docs/'))
)
```

## `buildIndex(indexName, indexer)`

**indexName** is a string which names your index.

**indexer** is a function which allows you to emit one or more keys for
each file that Gulp handles. Arguments:

- `file` is the file that is currently being processed.
- `emit` is a function that accepts a key and a value, and stores the
  association.
- `done` is a callback which you MUST call when you are done with this
  file. Failure to do so will cause the Gulp stream to never terminate.

## Using the resulting indexes
Files emitted from the resulting stream will have two new methods for
you to use. These methods are named based on the index name; e.g., an
index named `keywords` will result in methods named `lookupKeywords`
and `allIndexedKeywords`.

- **`lookupX(key)`** Get the list of values saved for the given key.
- **`allIndexedX()`** Get an array of all keys emitted over the lifetime
  of the stream.

### Example indexers

Indexing the full text of each document (warning: this may use too much memory):
```js
buildIndex('fullText', (file, emit, done) => {
  const contents = file.contents.toString();
  contents.split(' ')
    .map((w) => w.replace(/[^a-z]/gi, '').toLowerCase())
    .filter(Boolean)
    .forEach((word) => emit(word, 1));
  done();
})
```

If you use `gulp-front-matter` to process front-matter on your
documents, you can index by that information. For instance, keywords:

```js
buildIndex('keywords', (file, emit, done) => {
  const keywords = file.frontMatter.keywords;
  const fileBasename = basename(file.path);
  keywords.forEach((keyword) => emit(keyword, fileBasename));
  done();
});
```
