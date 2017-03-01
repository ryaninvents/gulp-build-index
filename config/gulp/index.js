import gulp from 'gulp';
import babel from 'gulp-babel';
import lint from 'gulp-eslint';

const SOURCES = ['src/**/*.js', '!**/*.test.js'];

gulp.task('js.transpile', ['js.lint'], () =>
  gulp.src(SOURCES)
    .pipe(babel())
    .pipe(gulp.dest('lib/'))
);

gulp.task('js.lint', () =>
  gulp.src(SOURCES)
    .pipe(lint())
    .pipe(lint.format())
    .pipe(lint.failAfterError())
);

gulp.task('js', ['js.transpile']);

gulp.task('build:prod', ['js']);
