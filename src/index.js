import through2 from 'through2';
import DelayedStream from 'delayed-stream';
import es from 'event-stream';
import * as Im from 'immutable';

/** Return the passed string with the first letter capitalized. */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Create a stream which indexes passed files by the given function,
 * then attaches a method to each file permitting lookups on that
 * index.
 */
export default function buildIndex(
  indexName/*: string */,
  indexer/*: (
    file: Vinyl,
    emit: (key: string, val: any) => void,
    done: () => void
  ) => void */
) {
  const methodName = `lookup${cap(indexName)}`;
  const allKeysMethodName = `allIndexed${cap(indexName)}`;
  let cache = new Im.Map();

  /** Function that will eventually be bound as a method to each object. */
  function lookup(key) {
    const maybeList = cache.get(key);
    if (!maybeList) return null;
    return [...maybeList];
  }
  Object.defineProperty(lookup, 'name', {value: methodName});
  /**
   * Function that will be bound as a method which returns all available keys.
   */
  function allKeys() {
    return [...cache.keys()];
  }
  Object.defineProperty(allKeys, 'name', {value: allKeysMethodName});

  /** Function that adds a value to the cache. */
  function emit(key/*: string */, newValue/*: any */)/*: void */ {
    const values = (cache.get(key) || []);
    cache = cache.set(key, [...values, newValue]);
  }

  /**
   * Handle a single file from input.
   * @this Stream
   */
  function handleFile(file, enc, done) {
    this.push(file);
    indexer(file, emit, done);
  }

  /**
   * Add the index-lookup method to each object.
   * @this Stream
   */
  function addLookupMethod(file, enc, done) {
    const newFile = file.clone();
    newFile[methodName] = lookup;
    newFile[allKeysMethodName] = allKeys;
    this.push(newFile);
    done();
  }

  /** Input stream which will receive and index the files. */
  const input = through2.obj(handleFile);
  /** Stream which receives each file from `input`. */
  const indexed = through2.obj();
  /** Delayed stream which does not emit any files until `input` ends. */
  const delayed = DelayedStream.create(indexed);
  /** Stream which pushes the modified files. */
  const output = through2.obj(addLookupMethod);

  input.pipe(indexed);
  // Wait for the input stream to end before pushing any files so that
  // we can be sure the index is complete (has "seen" all files).
  input.on('end', () => {
    delayed.pipe(output);
  });

  return es.duplex(input, output);
}
